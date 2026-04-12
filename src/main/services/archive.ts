import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, resolve, sep } from 'path'
import Database from 'better-sqlite3'
import {
  LEONARDO_ARCHIVE_DB_NAME,
  LEONARDO_ARCHIVE_MEDIA_DIR,
  LEONARDO_ARCHIVE_THUMBNAILS_DIR,
  LEONARDO_ARCHIVE_SETTINGS_FILE,
} from '@shared/constants'

export interface ArchiveExportOptions {
  projectId: string
  dbPath: string
  mediaFiles: string[]
  thumbnailFiles: string[]
  settings: Record<string, unknown>
  outputPath: string
}

export interface ArchiveImportResult {
  dbPath: string
  mediaDir: string
  thumbnailsDir: string
  settings: Record<string, unknown>
}

export function exportArchive(options: ArchiveExportOptions): string {
  const zip = new AdmZip()

  // Copy just this project's data into a standalone SQLite DB
  const sourceDb = new Database(options.dbPath, { readonly: true })
  const tempDbPath = options.outputPath + '.tmp.db'
  const destDb = new Database(tempDbPath)

  // Copy schema
  const tables = sourceDb
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { sql: string }[]
  for (const { sql } of tables) {
    destDb.exec(sql)
  }

  // Copy project row and related data
  const projectRow = sourceDb.prepare('SELECT * FROM projects WHERE id = ?').get(options.projectId)
  if (!projectRow) {
    destDb.close()
    sourceDb.close()
    throw new Error(`Project ${options.projectId} not found`)
  }

  copyTableRows(sourceDb, destDb, 'projects', 'id = ?', [options.projectId])
  copyTableRows(sourceDb, destDb, 'recordings', 'project_id = ?', [options.projectId])
  copyTableRows(sourceDb, destDb, 'scripts', 'project_id = ?', [options.projectId])

  // Copy script_sections for this project's scripts
  const scriptIds = sourceDb
    .prepare('SELECT id FROM scripts WHERE project_id = ?')
    .all(options.projectId) as { id: string }[]
  for (const { id } of scriptIds) {
    copyTableRows(sourceDb, destDb, 'script_sections', 'script_id = ?', [id])
  }

  // Copy voice profiles referenced by script sections
  const voiceIds = destDb
    .prepare('SELECT DISTINCT voice_profile_id FROM script_sections WHERE voice_profile_id IS NOT NULL')
    .all() as { voice_profile_id: string }[]
  for (const { voice_profile_id } of voiceIds) {
    copyTableRows(sourceDb, destDb, 'voice_profiles', 'id = ?', [voice_profile_id])
  }

  // Copy clips for this project + global clips
  copyTableRows(sourceDb, destDb, 'clips', 'project_id = ? OR is_global = 1', [options.projectId])

  destDb.close()
  sourceDb.close()

  // Add DB to archive
  zip.addLocalFile(tempDbPath, '', LEONARDO_ARCHIVE_DB_NAME)

  // Add media files
  for (const mediaFile of options.mediaFiles) {
    if (existsSync(mediaFile)) {
      zip.addLocalFile(mediaFile, LEONARDO_ARCHIVE_MEDIA_DIR)
    }
  }

  // Add thumbnails
  for (const thumbFile of options.thumbnailFiles) {
    if (existsSync(thumbFile)) {
      zip.addLocalFile(thumbFile, LEONARDO_ARCHIVE_THUMBNAILS_DIR)
    }
  }

  // Add settings
  zip.addFile(LEONARDO_ARCHIVE_SETTINGS_FILE, Buffer.from(JSON.stringify(options.settings, null, 2)))

  zip.writeZip(options.outputPath)

  // Clean up temp DB
  try {
    unlinkSync(tempDbPath)
  } catch {
    // best effort cleanup
  }

  return options.outputPath
}

export function importArchive(archivePath: string, extractDir: string): ArchiveImportResult {
  if (!existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`)
  }

  const zip = new AdmZip(archivePath)

  // Ensure extraction directories exist
  const mediaDir = join(extractDir, LEONARDO_ARCHIVE_MEDIA_DIR)
  const thumbnailsDir = join(extractDir, LEONARDO_ARCHIVE_THUMBNAILS_DIR)
  mkdirSync(extractDir, { recursive: true })
  mkdirSync(mediaDir, { recursive: true })
  mkdirSync(thumbnailsDir, { recursive: true })

  extractArchiveSafely(zip, extractDir)

  const dbPath = join(extractDir, LEONARDO_ARCHIVE_DB_NAME)
  const settingsPath = join(extractDir, LEONARDO_ARCHIVE_SETTINGS_FILE)

  let settings: Record<string, unknown> = {}
  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  }

  return { dbPath, mediaDir, thumbnailsDir, settings }
}

function extractArchiveSafely(zip: AdmZip, extractDir: string): void {
  for (const entry of zip.getEntries()) {
    const destinationPath = resolveArchiveEntryPath(extractDir, entry.entryName)

    if (entry.isDirectory) {
      mkdirSync(destinationPath, { recursive: true })
      continue
    }

    mkdirSync(resolve(destinationPath, '..'), { recursive: true })
    writeFileSync(destinationPath, entry.getData())
  }
}

export function resolveArchiveEntryPath(extractDir: string, entryName: string): string {
  const rootDir = ensureTrailingSeparator(resolve(extractDir))
  const destinationPath = resolve(extractDir, entryName)
  if (!destinationPath.startsWith(rootDir)) {
    throw new Error(`Archive contains invalid entry path: ${entryName}`)
  }
  return destinationPath
}

function ensureTrailingSeparator(path: string): string {
  return path.endsWith(sep) ? path : path + sep
}

function copyTableRows(
  source: Database.Database,
  dest: Database.Database,
  table: string,
  whereClause: string,
  params: unknown[],
): void {
  const rows = source.prepare(`SELECT * FROM ${table} WHERE ${whereClause}`).all(...params)
  if (rows.length === 0) return

  const columns = Object.keys(rows[0] as Record<string, unknown>)
  const placeholders = columns.map(() => '?').join(', ')
  const insert = dest.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)

  const insertMany = dest.transaction((rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      insert.run(...columns.map((c) => row[c]))
    }
  })

  insertMany(rows as Record<string, unknown>[])
}
