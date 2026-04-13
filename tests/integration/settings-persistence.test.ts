import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-electron',
  },
}))

import { initDatabase, closeDatabase } from '@main/services/project-store'
import { getSetting, setSetting, deleteSetting } from '@main/services/settings'

describe('settings persistence (real SQLite)', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-settings-test-'))
    const dbPath = join(tempDir, 'test.db')
    initDatabase(dbPath)
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('persists a value and retrieves it', () => {
    setSetting('theme', 'dark')
    expect(getSetting('theme')).toBe('dark')
  })

  it('overwrites an existing value', () => {
    setSetting('language', 'en')
    setSetting('language', 'fr')
    expect(getSetting('language')).toBe('fr')
  })

  it('deleteSetting removes the key so getSetting returns null', () => {
    setSetting('temp_key', 'hello')
    expect(getSetting('temp_key')).toBe('hello')

    deleteSetting('temp_key')
    expect(getSetting('temp_key')).toBeNull()
  })

  it('multiple settings coexist independently', () => {
    setSetting('a', 'alpha')
    setSetting('b', 'beta')
    setSetting('c', 'gamma')

    expect(getSetting('a')).toBe('alpha')
    expect(getSetting('b')).toBe('beta')
    expect(getSetting('c')).toBe('gamma')

    // Modify one, others unchanged
    setSetting('b', 'BRAVO')
    expect(getSetting('a')).toBe('alpha')
    expect(getSetting('b')).toBe('BRAVO')
    expect(getSetting('c')).toBe('gamma')
  })
})
