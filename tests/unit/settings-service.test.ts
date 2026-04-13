// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { createTempDir, removeTempDir } from '@test/db-harness'

// ---- Mock electron before any imports that use it ----
let tempDir = ''

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => tempDir,
  },
}))

import {
  initDatabase,
  closeDatabase,
} from '@main/services/project-store'
import {
  getSetting,
  setSetting,
  deleteSetting,
  isDirtyShutdown,
  markShutdownDirty,
  markShutdownClean,
} from '@main/services/settings'

describe('settings service', () => {
  beforeEach(() => {
    tempDir = createTempDir()
    // Initialize fresh DB in temp dir
    initDatabase(join(tempDir, 'test.db'))
  })

  afterEach(() => {
    closeDatabase()
    removeTempDir(tempDir)
  })

  it('getSetting returns null for unknown key', () => {
    expect(getSetting('nonexistent-key')).toBeNull()
  })

  it('setSetting and getSetting round-trip', () => {
    setSetting('my-key', 'my-value')
    expect(getSetting('my-key')).toBe('my-value')
  })

  it('setSetting overwrites existing value', () => {
    setSetting('my-key', 'first')
    setSetting('my-key', 'second')
    expect(getSetting('my-key')).toBe('second')
  })

  it('deleteSetting removes the key', () => {
    setSetting('my-key', 'my-value')
    deleteSetting('my-key')
    expect(getSetting('my-key')).toBeNull()
  })

  it('deleteSetting is safe for non-existent key (no throw)', () => {
    expect(() => deleteSetting('nonexistent-key')).not.toThrow()
  })

  it('isDirtyShutdown returns false by default', () => {
    expect(isDirtyShutdown()).toBe(false)
  })

  it('markShutdownDirty sets flag, markShutdownClean clears it', () => {
    markShutdownDirty()
    expect(isDirtyShutdown()).toBe(true)

    markShutdownClean()
    expect(isDirtyShutdown()).toBe(false)
  })

  it('multiple setSetting calls with different keys are independent', () => {
    setSetting('key-a', 'val-a')
    setSetting('key-b', 'val-b')
    expect(getSetting('key-a')).toBe('val-a')
    expect(getSetting('key-b')).toBe('val-b')
  })
})
