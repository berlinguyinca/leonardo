import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

// Mock electron's app.getPath before importing project-store
// The module uses app.getPath('userData') for the default path,
// but we use initDatabase(path) to inject a test path instead.
import { vi } from 'vitest'
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-electron',
  },
}))

import {
  initDatabase,
  closeDatabase,
  getDatabase,
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
} from '@main/services/project-store'
import type { Resolution } from '@shared/types/project'

describe('project-store (real SQLite)', () => {
  let tempDir: string
  let dbPath: string

  const resolution1080p: Resolution = { width: 1920, height: 1080, label: '1080p' }
  const resolution4k: Resolution = { width: 3840, height: 2160, label: '4K' }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-test-'))
    dbPath = join(tempDir, 'test.db')
    initDatabase(dbPath)
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('database initialization', () => {
    it('creates a database with WAL journal mode', () => {
      const db = getDatabase()
      const result = db.pragma('journal_mode') as { journal_mode: string }[]
      expect(result[0].journal_mode).toBe('wal')
    })

    it('creates a database with foreign keys enabled', () => {
      const db = getDatabase()
      const result = db.pragma('foreign_keys') as { foreign_keys: number }[]
      expect(result[0].foreign_keys).toBe(1)
    })

    it('creates all required tables', () => {
      const db = getDatabase()
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[]
      const tableNames = tables.map((t) => t.name)

      expect(tableNames).toContain('projects')
      expect(tableNames).toContain('recordings')
      expect(tableNames).toContain('scripts')
      expect(tableNames).toContain('script_sections')
      expect(tableNames).toContain('voice_profiles')
      expect(tableNames).toContain('clips')
      expect(tableNames).toContain('settings')
    })
  })

  describe('createProject', () => {
    it('creates a project and returns it', () => {
      const project = createProject('p-1', 'My Project', 'record-first', resolution1080p)

      expect(project.id).toBe('p-1')
      expect(project.name).toBe('My Project')
      expect(project.inputMode).toBe('record-first')
      expect(project.status).toBe('draft')
      expect(project.recordingResolution).toEqual(resolution1080p)
      expect(project.exportConfig).toBeNull()
      expect(project.createdAt).toBeDefined()
      expect(project.updatedAt).toBeDefined()
    })

    it('persists the project to the database', () => {
      createProject('p-2', 'Persistent Project', 'prompt-first', resolution4k)
      const retrieved = getProject('p-2')

      expect(retrieved).not.toBeNull()
      expect(retrieved!.name).toBe('Persistent Project')
      expect(retrieved!.inputMode).toBe('prompt-first')
      expect(retrieved!.recordingResolution).toEqual(resolution4k)
    })

    it('rejects duplicate project IDs', () => {
      createProject('p-dup', 'First', 'record-first', resolution1080p)
      expect(() => {
        createProject('p-dup', 'Second', 'record-first', resolution1080p)
      }).toThrow()
    })
  })

  describe('getProject', () => {
    it('returns null for non-existent project', () => {
      const result = getProject('non-existent')
      expect(result).toBeNull()
    })

    it('returns the correct project', () => {
      createProject('p-get', 'Get Test', 'simultaneous', resolution1080p)
      const project = getProject('p-get')

      expect(project!.id).toBe('p-get')
      expect(project!.name).toBe('Get Test')
      expect(project!.inputMode).toBe('simultaneous')
    })
  })

  describe('listProjects', () => {
    it('returns empty array when no projects exist', () => {
      const projects = listProjects()
      expect(projects).toEqual([])
    })

    it('returns all projects sorted by updatedAt desc', () => {
      createProject('p-a', 'Project A', 'record-first', resolution1080p)
      createProject('p-b', 'Project B', 'prompt-first', resolution1080p)
      createProject('p-c', 'Project C', 'simultaneous', resolution1080p)

      // Update p-a to make it the most recently updated
      updateProject('p-a', { name: 'Updated A' })

      const projects = listProjects()
      expect(projects).toHaveLength(3)
      expect(projects[0].id).toBe('p-a')
    })
  })

  describe('updateProject', () => {
    it('updates the project name', () => {
      createProject('p-upd', 'Original', 'record-first', resolution1080p)
      const updated = updateProject('p-upd', { name: 'Renamed' })

      expect(updated!.name).toBe('Renamed')
      expect(updated!.inputMode).toBe('record-first')
    })

    it('updates the project status', () => {
      createProject('p-status', 'Status Test', 'record-first', resolution1080p)
      const updated = updateProject('p-status', { status: 'recording' })

      expect(updated!.status).toBe('recording')
    })

    it('updates recording resolution', () => {
      createProject('p-res', 'Res Test', 'record-first', resolution1080p)
      const updated = updateProject('p-res', { recordingResolution: resolution4k })

      expect(updated!.recordingResolution).toEqual(resolution4k)
    })

    it('updates export config', () => {
      createProject('p-exp', 'Export Test', 'record-first', resolution1080p)
      const exportConfig = {
        codec: 'h264' as const,
        resolution: resolution1080p,
        targetType: 'file' as const,
      }
      const updated = updateProject('p-exp', { exportConfig })

      expect(updated!.exportConfig).toEqual(exportConfig)
    })

    it('returns null for non-existent project', () => {
      const result = updateProject('ghost', { name: 'Nope' })
      expect(result).toBeNull()
    })

    it('updates the updatedAt timestamp', () => {
      createProject('p-time', 'Time Test', 'record-first', resolution1080p)
      const original = getProject('p-time')

      // Small delay to ensure different timestamp
      const updated = updateProject('p-time', { name: 'Renamed' })

      expect(updated!.updatedAt).toBeDefined()
      // updatedAt should be >= original
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original!.updatedAt).getTime(),
      )
    })
  })

  describe('deleteProject', () => {
    it('deletes an existing project', () => {
      createProject('p-del', 'Delete Me', 'record-first', resolution1080p)
      const result = deleteProject('p-del')

      expect(result).toBe(true)
      expect(getProject('p-del')).toBeNull()
    })

    it('returns false for non-existent project', () => {
      const result = deleteProject('ghost')
      expect(result).toBe(false)
    })

    it('cascades deletes to recordings', () => {
      createProject('p-cascade', 'Cascade Test', 'record-first', resolution1080p)
      const db = getDatabase()

      // Insert a recording referencing this project
      db.prepare(
        `INSERT INTO recordings (id, project_id, video_file, resolution_width, resolution_height, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('r-1', 'p-cascade', '/tmp/video.mp4', 1920, 1080, new Date().toISOString())

      const beforeDelete = db.prepare('SELECT COUNT(*) as count FROM recordings WHERE project_id = ?').get('p-cascade') as { count: number }
      expect(beforeDelete.count).toBe(1)

      deleteProject('p-cascade')

      const afterDelete = db.prepare('SELECT COUNT(*) as count FROM recordings WHERE project_id = ?').get('p-cascade') as { count: number }
      expect(afterDelete.count).toBe(0)
    })

    it('cascades deletes to scripts and script_sections', () => {
      createProject('p-cascade2', 'Cascade2', 'record-first', resolution1080p)
      const db = getDatabase()

      db.prepare(
        `INSERT INTO scripts (id, project_id, ai_backend_used, generated_at)
         VALUES (?, ?, ?, ?)`,
      ).run('sc-1', 'p-cascade2', 'claude', new Date().toISOString())

      db.prepare(
        `INSERT INTO script_sections (id, script_id, text, sort_order)
         VALUES (?, ?, ?, ?)`,
      ).run('ss-1', 'sc-1', 'Hello world', 0)

      deleteProject('p-cascade2')

      const scripts = db.prepare('SELECT COUNT(*) as count FROM scripts WHERE project_id = ?').get('p-cascade2') as { count: number }
      const sections = db.prepare('SELECT COUNT(*) as count FROM script_sections WHERE script_id = ?').get('sc-1') as { count: number }
      expect(scripts.count).toBe(0)
      expect(sections.count).toBe(0)
    })
  })

  describe('database resilience', () => {
    it('getDatabase returns the same instance', () => {
      const db1 = getDatabase()
      const db2 = getDatabase()
      expect(db1).toBe(db2)
    })

    it('closeDatabase and reinitialize works', () => {
      createProject('p-close', 'Close Test', 'record-first', resolution1080p)
      closeDatabase()

      // Re-init with same path
      initDatabase(dbPath)
      const project = getProject('p-close')
      expect(project).not.toBeNull()
      expect(project!.name).toBe('Close Test')
    })
  })
})
