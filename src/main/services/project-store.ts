import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { DB_FILENAME } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types'
import type { Clip } from '@shared/types/events'
import type { Script, ScriptSection } from '@shared/types/ai'

let db: Database.Database | null = null

function getDbPath(): string {
  return join(app.getPath('userData'), DB_FILENAME)
}

export function initDatabase(dbPath?: string): Database.Database {
  if (db) return db
  db = new Database(dbPath ?? getDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

export function getDatabase(): Database.Database {
  if (!db) return initDatabase()
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      input_mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      recording_resolution_width INTEGER NOT NULL DEFAULT 1920,
      recording_resolution_height INTEGER NOT NULL DEFAULT 1080,
      recording_resolution_label TEXT NOT NULL DEFAULT '1080p',
      export_config TEXT
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      video_file TEXT NOT NULL,
      dom_events TEXT NOT NULL DEFAULT '[]',
      duration REAL NOT NULL DEFAULT 0,
      url TEXT NOT NULL DEFAULT '',
      resolution_width INTEGER NOT NULL,
      resolution_height INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      ai_backend_used TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      generated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS script_sections (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      text TEXT NOT NULL,
      voice_profile_id TEXT,
      start_time REAL NOT NULL DEFAULT 0,
      end_time REAL NOT NULL DEFAULT 0,
      timing_markers TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voice_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      voice_id TEXT NOT NULL,
      samples TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      type TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 0,
      thumbnail TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      project_id TEXT,
      is_global INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Idempotent column additions for clips table (added in v2)
  for (const sql of [
    `ALTER TABLE clips ADD COLUMN url TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE clips ADD COLUMN resolution_width INTEGER NOT NULL DEFAULT 1920`,
    `ALTER TABLE clips ADD COLUMN resolution_height INTEGER NOT NULL DEFAULT 1080`,
  ]) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }

  // Idempotent column additions for scripts table (added in v3)
  for (const sql of [
    `ALTER TABLE scripts ADD COLUMN clip_id TEXT REFERENCES clips(id) ON DELETE SET NULL`,
  ]) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }
}

// --- Project CRUD ---

export function createProject(
  id: string,
  name: string,
  inputMode: InputModeType,
  resolution: Resolution,
): Project {
  const now = new Date().toISOString()
  const db = getDatabase()
  db.prepare(`
    INSERT INTO projects (id, name, input_mode, status, created_at, updated_at,
      recording_resolution_width, recording_resolution_height, recording_resolution_label)
    VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).run(id, name, inputMode, now, now, resolution.width, resolution.height, resolution.label)

  return {
    id,
    name,
    inputMode,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    recordingResolution: resolution,
    exportConfig: null,
  }
}

export function getProject(id: string): Project | null {
  const db = getDatabase()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null
  return rowToProject(row)
}

export function listProjects(): Project[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToProject)
}

export function updateProject(id: string, updates: Partial<Project>): Project | null {
  const existing = getProject(id)
  if (!existing) return null

  const db = getDatabase()
  const now = new Date().toISOString()

  if (updates.name !== undefined) {
    db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(updates.name, now, id)
  }
  if (updates.status !== undefined) {
    db.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').run(updates.status, now, id)
  }
  if (updates.inputMode !== undefined) {
    db.prepare('UPDATE projects SET input_mode = ?, updated_at = ? WHERE id = ?').run(updates.inputMode, now, id)
  }
  if (updates.recordingResolution !== undefined) {
    db.prepare(`UPDATE projects SET
      recording_resolution_width = ?, recording_resolution_height = ?,
      recording_resolution_label = ?, updated_at = ? WHERE id = ?`
    ).run(updates.recordingResolution.width, updates.recordingResolution.height,
      updates.recordingResolution.label, now, id)
  }
  if (updates.exportConfig !== undefined) {
    db.prepare('UPDATE projects SET export_config = ?, updated_at = ? WHERE id = ?')
      .run(updates.exportConfig ? JSON.stringify(updates.exportConfig) : null, now, id)
  }

  return getProject(id)
}

export function deleteProject(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return result.changes > 0
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    inputMode: row.input_mode as InputModeType,
    status: row.status as Project['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    recordingResolution: {
      width: row.recording_resolution_width as number,
      height: row.recording_resolution_height as number,
      label: row.recording_resolution_label as string,
    },
    exportConfig: row.export_config ? JSON.parse(row.export_config as string) : null,
  }
}

// --- Clip CRUD ---

export function createClip(clip: Clip): Clip {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO clips (id, name, file_path, type, duration, project_id, is_global, created_at, url, resolution_width, resolution_height)
    VALUES (?, ?, ?, 'video', ?, ?, 0, ?, ?, ?, ?)
  `).run(
    clip.id,
    clip.label,
    clip.filePath,
    clip.duration,
    clip.projectId || null,
    clip.createdAt,
    clip.url,
    clip.resolution.width,
    clip.resolution.height,
  )
  return clip
}

export function listClips(projectId?: string): Clip[] {
  const db = getDatabase()
  if (projectId) {
    const rows = db.prepare(
      'SELECT * FROM clips WHERE project_id = ? ORDER BY created_at DESC',
    ).all(projectId) as Record<string, unknown>[]
    return rows.map(rowToClip)
  }
  const rows = db.prepare('SELECT * FROM clips ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToClip)
}

export function deleteClip(id: string): boolean {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM clips WHERE id = ?').run(id)
  return result.changes > 0
}

function rowToClip(row: Record<string, unknown>): Clip {
  return {
    id: row.id as string,
    projectId: (row.project_id as string) || '',
    filePath: row.file_path as string,
    duration: row.duration as number,
    url: (row.url as string) || '',
    resolution: {
      width: (row.resolution_width as number) || 1920,
      height: (row.resolution_height as number) || 1080,
    },
    createdAt: row.created_at as string,
    label: row.name as string,
  }
}

// --- Script CRUD ---

export function saveScript(script: Script, clipId?: string): Script {
  const db = getDatabase()
  db.transaction(() => {
    db.prepare(`INSERT OR REPLACE INTO scripts (id, project_id, ai_backend_used, prompt, generated_at, clip_id) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(script.id, script.projectId, script.aiBackendUsed, script.prompt, script.generatedAt, clipId ?? null)
    db.prepare('DELETE FROM script_sections WHERE script_id = ?').run(script.id)
    const insertSection = db.prepare(`INSERT INTO script_sections (id, script_id, text, voice_profile_id, start_time, end_time, timing_markers, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const section of script.sections) {
      insertSection.run(section.id, script.id, section.text, section.voiceProfileId ?? null, section.startTime, section.endTime, JSON.stringify(section.timingMarkers), section.order)
    }
  })()
  return { ...script, clipId: clipId ?? script.clipId }
}

export function listScriptsByProject(
  projectId: string,
): Array<Script & { sections: ScriptSection[] }> {
  const db = getDatabase()
  const scriptRows = db.prepare(
    'SELECT * FROM scripts WHERE project_id = ? ORDER BY generated_at DESC',
  ).all(projectId) as Record<string, unknown>[]

  if (scriptRows.length === 0) return []

  const scriptIds = scriptRows.map((r) => r.id as string)
  const placeholders = scriptIds.map(() => '?').join(',')
  const allSectionRows = db.prepare(
    `SELECT * FROM script_sections WHERE script_id IN (${placeholders}) ORDER BY sort_order ASC`,
  ).all(...scriptIds) as Record<string, unknown>[]

  const sectionsByScriptId = new Map<string, ScriptSection[]>()
  for (const sr of allSectionRows) {
    const sid = sr.script_id as string
    if (!sectionsByScriptId.has(sid)) sectionsByScriptId.set(sid, [])
    sectionsByScriptId.get(sid)!.push({
      id: sr.id as string,
      scriptId: sr.script_id as string,
      text: sr.text as string,
      voiceProfileId: (sr.voice_profile_id as string) ?? null,
      startTime: sr.start_time as number,
      endTime: sr.end_time as number,
      timingMarkers: JSON.parse((sr.timing_markers as string) || '[]'),
      order: sr.sort_order as number,
    })
  }

  return scriptRows.map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    clipId: (row.clip_id as string) ?? undefined,
    aiBackendUsed: row.ai_backend_used as Script['aiBackendUsed'],
    prompt: row.prompt as string,
    generatedAt: row.generated_at as string,
    sections: sectionsByScriptId.get(row.id as string) ?? [],
  }))
}
