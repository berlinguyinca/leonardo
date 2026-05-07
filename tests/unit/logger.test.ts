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
const mockStatSync = vi.fn()
const mockRenameSync = vi.fn()
const mockTruncateSync = vi.fn()
const mockOpenSync = vi.fn()
const mockReadSync = vi.fn()
const mockCloseSync = vi.fn()

vi.mock('fs', () => ({
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  renameSync: (...args: unknown[]) => mockRenameSync(...args),
  truncateSync: (...args: unknown[]) => mockTruncateSync(...args),
  openSync: (...args: unknown[]) => mockOpenSync(...args),
  readSync: (...args: unknown[]) => mockReadSync(...args),
  closeSync: (...args: unknown[]) => mockCloseSync(...args),
}))

describe('logger', () => {
  let initLogger: () => void
  let readLog: (maxBytes?: number) => string
  let clearLog: () => void

  beforeEach(async () => {
    vi.resetModules()
    mockAppendFileSync.mockReset()
    mockReadFileSync.mockReset()
    mockExistsSync.mockReset()
    mockStatSync.mockReset()
    mockRenameSync.mockReset()
    mockTruncateSync.mockReset()
    mockOpenSync.mockReset()
    mockReadSync.mockReset()
    mockCloseSync.mockReset()

    // Default: stat returns small file size so rotation doesn't trigger
    mockStatSync.mockReturnValue({ size: 0 })

    // Re-import after resetting modules so logPath is fresh
    const mod = await import('../../src/main/utils/logger')
    initLogger = mod.initLogger
    readLog = mod.readLog
    clearLog = mod.clearLog
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
    mockStatSync.mockReturnValue({ size: 10 })
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
    mockStatSync.mockReturnValue({ size: stored.length })
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

  it('clearLog truncates the log file to zero bytes', () => {
    mockExistsSync.mockReturnValue(true)
    initLogger()

    clearLog()

    expect(mockTruncateSync).toHaveBeenCalledWith(
      expect.stringContaining('leonardo.log'),
      0,
    )
  })

  it('clearLog does not throw when file does not exist', () => {
    mockTruncateSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    initLogger()

    expect(() => clearLog()).not.toThrow()
  })

  it('rotates log file when size exceeds 5MB', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue({ size: 6 * 1024 * 1024 }) // 6 MB > 5 MB limit
    initLogger()

    console.log('trigger rotation')

    expect(mockRenameSync).toHaveBeenCalledWith(
      expect.stringContaining('leonardo.log'),
      expect.stringContaining('leonardo.log.1'),
    )
    expect(mockAppendFileSync).toHaveBeenCalled()
  })

  it('does not rotate when log file is below 5MB', () => {
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue({ size: 1024 }) // 1 KB — well under limit
    initLogger()

    console.log('no rotation')

    expect(mockRenameSync).not.toHaveBeenCalled()
  })

  it('readLog reads only the tail when file exceeds maxBytes', () => {
    const maxBytes = 100
    const fileSize = 300
    mockExistsSync.mockReturnValue(true)
    mockStatSync.mockReturnValue({ size: fileSize })
    const tailContent = '\nlog line A\nlog line B\n'
    mockOpenSync.mockReturnValue(42) // fd
    mockReadSync.mockImplementation(
      (_fd: number, buf: Buffer, _offset: number, _length: number, _position: number) => {
        const encoded = Buffer.from(tailContent)
        encoded.copy(buf)
        return encoded.length
      },
    )

    initLogger()
    const result = readLog(maxBytes)

    expect(mockOpenSync).toHaveBeenCalledWith(
      expect.stringContaining('leonardo.log'),
      'r',
    )
    expect(mockReadSync).toHaveBeenCalledWith(42, expect.any(Buffer), 0, maxBytes, fileSize - maxBytes)
    expect(mockCloseSync).toHaveBeenCalledWith(42)
    // First partial line before first newline is trimmed
    expect(result).toContain('log line A')
    expect(result).toContain('log line B')
  })
})
