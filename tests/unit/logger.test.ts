import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock electron before importing logger
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-logs'),
  },
}))

// Track fs calls with module-level spies
const mockAppendFileSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockExistsSync = vi.fn()

vi.mock('fs', () => ({
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}))

describe('logger', () => {
  let initLogger: () => void
  let readLog: () => string

  beforeEach(async () => {
    vi.resetModules()
    mockAppendFileSync.mockReset()
    mockReadFileSync.mockReset()
    mockExistsSync.mockReset()

    // Re-import after resetting modules so logPath is fresh
    const mod = await import('../../src/main/utils/logger')
    initLogger = mod.initLogger
    readLog = mod.readLog
  })

  afterEach(() => {
    // Restore console methods patched by initLogger
    vi.restoreAllMocks()
  })

  it('initLogger writes to the log file when console.log is called', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('')
    initLogger()

    console.log('hello from test')

    expect(mockAppendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('leonardo.log'),
      expect.stringContaining('[INFO] hello from test'),
    )
  })

  it('readLog returns the file contents when the log file exists', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('[INFO] existing log line\n')
    initLogger()

    const result = readLog()
    expect(result).toContain('[INFO] existing log line')
  })

  it('readLog returns empty string when the log file does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    initLogger()

    const result = readLog()
    expect(result).toBe('')
  })

  it('logged messages appear in readLog output', () => {
    let stored = ''
    mockAppendFileSync.mockImplementation((_path: string, data: string) => {
      stored += data
    })
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation(() => stored)

    initLogger()
    console.warn('watch out')

    const result = readLog()
    expect(result).toContain('[WARN] watch out')
  })

  it('handles appendFileSync write errors gracefully without throwing', () => {
    mockAppendFileSync.mockImplementation(() => {
      throw new Error('disk full')
    })
    mockExistsSync.mockReturnValue(true)
    initLogger()

    // Should not throw even though the underlying write fails
    expect(() => console.error('boom')).not.toThrow()
  })
})
