import { getDatabase } from './project-store'

export function getSetting(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

export function deleteSetting(key: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM settings WHERE key = ?').run(key)
}

export function isDirtyShutdown(): boolean {
  return getSetting('dirty_shutdown') === 'true'
}

export function markShutdownDirty(): void {
  setSetting('dirty_shutdown', 'true')
}

export function markShutdownClean(): void {
  deleteSetting('dirty_shutdown')
}
