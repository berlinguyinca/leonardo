import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { vi } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-electron',
  },
}))

import {
  initDatabase,
  closeDatabase,
  createProject,
  getDatabase,
} from '@main/services/project-store'
import { exportArchive, importArchive, resolveArchiveEntryPath } from '@main/services/archive'

describe('archive service (real SQLite + real zip)', () => {
  let tempDir: string
  let dbPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-archive-test-'))
    dbPath = join(tempDir, 'test.db')
    initDatabase(dbPath)
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('exports and imports a project archive', () => {
    // Create a project with some data
    createProject('p-archive', 'Archive Test', 'record-first', {
      width: 1920,
      height: 1080,
      label: '1080p',
    })

    // Add a recording to the DB
    const db = getDatabase()
    db.prepare(
      `INSERT INTO recordings (id, project_id, video_file, resolution_width, resolution_height, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('r-1', 'p-archive', '/tmp/video.mp4', 1920, 1080, new Date().toISOString())

    // Create a fake media file
    const mediaFile = join(tempDir, 'video.mp4')
    writeFileSync(mediaFile, 'fake video content')

    const archivePath = join(tempDir, 'test.leonardo')

    // Export
    const outputPath = exportArchive({
      projectId: 'p-archive',
      dbPath,
      mediaFiles: [mediaFile],
      thumbnailFiles: [],
      settings: { version: 1, theme: 'dark' },
      outputPath: archivePath,
    })

    expect(outputPath).toBe(archivePath)
    expect(existsSync(archivePath)).toBe(true)

    // Import into a new directory
    const importDir = join(tempDir, 'imported')
    const result = importArchive(archivePath, importDir)

    expect(existsSync(result.dbPath)).toBe(true)
    expect(result.settings).toEqual({ version: 1, theme: 'dark' })

    // Verify the imported DB has the project
    const importedDb = new Database(result.dbPath, { readonly: true })
    const project = importedDb.prepare('SELECT * FROM projects WHERE id = ?').get('p-archive') as Record<string, unknown>
    expect(project).toBeDefined()
    expect(project.name).toBe('Archive Test')

    const recordings = importedDb.prepare('SELECT * FROM recordings WHERE project_id = ?').all('p-archive')
    expect(recordings).toHaveLength(1)

    importedDb.close()

    // Verify media file was included
    const importedMedia = join(result.mediaDir, 'video.mp4')
    expect(existsSync(importedMedia)).toBe(true)
  })

  it('throws for non-existent project', () => {
    const archivePath = join(tempDir, 'bad.leonardo')
    expect(() =>
      exportArchive({
        projectId: 'non-existent',
        dbPath,
        mediaFiles: [],
        thumbnailFiles: [],
        settings: {},
        outputPath: archivePath,
      }),
    ).toThrow('Project non-existent not found')
  })

  it('throws for non-existent archive on import', () => {
    const importDir = join(tempDir, 'empty-import')
    expect(() => importArchive('/tmp/does-not-exist.leonardo', importDir)).toThrow(
      'Archive not found',
    )
  })

  it('rejects archive entry path traversal', () => {
    expect(() => resolveArchiveEntryPath(join(tempDir, 'evil-import'), '../../escape.txt')).toThrow(
      'Archive contains invalid entry path',
    )
  })

  it('exports only the specified project (not other projects)', () => {
    createProject('p-1', 'Project 1', 'record-first', { width: 1920, height: 1080, label: '1080p' })
    createProject('p-2', 'Project 2', 'prompt-first', { width: 1920, height: 1080, label: '1080p' })

    const archivePath = join(tempDir, 'single.leonardo')
    exportArchive({
      projectId: 'p-1',
      dbPath,
      mediaFiles: [],
      thumbnailFiles: [],
      settings: {},
      outputPath: archivePath,
    })

    const importDir = join(tempDir, 'single-import')
    const result = importArchive(archivePath, importDir)

    const importedDb = new Database(result.dbPath, { readonly: true })
    const projects = importedDb.prepare('SELECT * FROM projects').all()
    expect(projects).toHaveLength(1)
    expect((projects[0] as Record<string, unknown>).id).toBe('p-1')
    importedDb.close()
  })
})
