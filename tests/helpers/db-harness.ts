import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

export interface TestDB {
  tempDir: string
}

/**
 * Creates a temp directory and initializes a real SQLite database.
 * Call in beforeEach. Pair with teardownTestDB in afterEach.
 *
 * Requires: vi.mock('electron', () => ({ app: { getPath: () => tempDir } }))
 * before import, since project-store reads app.getPath('userData').
 */
export function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'leonardo-test-'))
}

export function removeTempDir(tempDir: string): void {
  rmSync(tempDir, { recursive: true, force: true })
}
