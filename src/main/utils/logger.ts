import { app } from 'electron'
import { appendFileSync, readFileSync, existsSync, statSync, renameSync, truncateSync, openSync, readSync, closeSync } from 'fs'
import { join } from 'path'

const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const DEFAULT_TAIL_BYTES = 500 * 1024 // 500 KB

let logPath: string

export function initLogger(): void {
  logPath = join(app.getPath('logs'), 'leonardo.log')

  const orig = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }

  console.log = (...args: unknown[]) => {
    orig.log(...args)
    writeLog('INFO', args)
  }
  console.warn = (...args: unknown[]) => {
    orig.warn(...args)
    writeLog('WARN', args)
  }
  console.error = (...args: unknown[]) => {
    orig.error(...args)
    writeLog('ERROR', args)
  }
}

function rotateIfNeeded(): void {
  try {
    if (!existsSync(logPath)) return
    const { size } = statSync(logPath)
    if (size > MAX_LOG_SIZE_BYTES) {
      renameSync(logPath, `${logPath}.1`)
    }
  } catch {
    // Ignore rotation errors
  }
}

function writeLog(level: string, args: unknown[]): void {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(String).join(' ')}\n`
  try {
    rotateIfNeeded()
    appendFileSync(logPath, line)
  } catch {
    // Ignore write errors (e.g. during shutdown)
  }
}

export function clearLog(): void {
  if (!logPath) return
  try {
    truncateSync(logPath, 0)
  } catch {
    // Ignore errors if file doesn't exist yet
  }
}

export function readLog(maxBytes: number = DEFAULT_TAIL_BYTES): string {
  if (!logPath || !existsSync(logPath)) return ''
  try {
    const { size } = statSync(logPath)
    if (size <= maxBytes) {
      return readFileSync(logPath, 'utf-8')
    }
    // Read only the tail
    const offset = size - maxBytes
    const buf = Buffer.allocUnsafe(maxBytes)
    const fd = openSync(logPath, 'r')
    try {
      const bytesRead = readSync(fd, buf, 0, maxBytes, offset)
      const tail = buf.slice(0, bytesRead).toString('utf-8')
      // Trim to the first newline so we don't return a partial line at the start
      const firstNewline = tail.indexOf('\n')
      return firstNewline >= 0 ? tail.slice(firstNewline + 1) : tail
    } finally {
      closeSync(fd)
    }
  } catch {
    return ''
  }
}
