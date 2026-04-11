import { app } from 'electron'
import { appendFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

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

function writeLog(level: string, args: unknown[]): void {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(String).join(' ')}\n`
  try {
    appendFileSync(logPath, line)
  } catch {
    // Ignore write errors (e.g. during shutdown)
  }
}

export function readLog(): string {
  if (!logPath || !existsSync(logPath)) return ''
  try {
    return readFileSync(logPath, 'utf-8')
  } catch {
    return ''
  }
}
