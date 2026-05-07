// src/main/services/ai/cli-runner.ts
import { spawn, execFileSync } from 'child_process'
import path from 'path'

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024 // 10MB

export interface CLIRunResult {
  stdout: string
  stderr: string
}

/**
 * Run a CLI binary with arguments, optionally piping data to stdin.
 * Returns stdout/stderr. Rejects on non-zero exit, timeout, or spawn failure.
 */
export function runCLI(
  binary: string,
  args: string[],
  stdinData?: string,
  timeoutMs: number = 120_000,
): Promise<CLIRunResult> {
  return new Promise((resolve, reject) => {
    // Log the command (redact long stdin to avoid flooding logs)
    const argSummary = args.filter((a) => a.length < 200).join(' ')
    console.log(`[CLI] Spawning: ${binary} ${argSummary} (stdin: ${stdinData ? `${stdinData.length} chars` : 'none'})`)

    const proc = spawn(binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
      reject(new Error(`${binary} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      if (stdout.length > MAX_OUTPUT_BYTES) {
        killed = true
        proc.kill('SIGTERM')
        reject(new Error(`${binary} output exceeded maximum size of 10MB`))
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT') {
        reject(new Error(`CLI binary "${binary}" not found. Ensure it is installed and on your PATH.`))
      } else {
        reject(err)
      }
    })

    proc.on('close', (code, signal) => {
      clearTimeout(timer)
      if (killed) return // already rejected by timeout

      if (signal) {
        reject(new Error(`${binary} was terminated by signal ${signal}`))
        return
      }

      if (code !== 0) {
        // Include both stderr and stdout in error — some CLIs (e.g. Claude) write errors to stdout
        const errorOutput = stderr.trim() || stdout.trim()
        const detail = errorOutput.slice(-500) || '(no output)'
        console.error(`[CLI] ${binary} exited with code ${code}: ${detail}`)
        reject(new Error(`${binary} exited with code ${code}: ${detail}`))
        return
      }

      console.log(`[CLI] ${binary} completed successfully (${stdout.length} chars output)`)
      resolve({ stdout, stderr })
    })

    if (stdinData !== undefined) {
      proc.stdin.write(stdinData)
      proc.stdin.end()
    } else {
      proc.stdin.end()
    }
  })
}

/**
 * Run a CLI binary with streaming stdout.
 * Calls onStdout per data event on stdout.
 * Returns the full concatenated output when the process completes.
 */
export function runCLIStreaming(
  binary: string,
  args: string[],
  stdinData: string | null,
  onStdout: (chunk: string) => void,
  timeoutMs = 120_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const argSummary = args.filter((a) => a.length < 200).join(' ')
    console.log(`[CLI:stream] Spawning: ${binary} ${argSummary} (stdin: ${stdinData ? `${stdinData.length} chars` : 'none'})`)

    const proc = spawn(binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
      reject(new Error(`${binary} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text
      if (stdout.length > MAX_OUTPUT_BYTES) {
        killed = true
        proc.kill('SIGTERM')
        reject(new Error(`${binary} output exceeded maximum size of 10MB`))
        return
      }
      onStdout(text)
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT') {
        reject(new Error(`CLI binary "${binary}" not found. Ensure it is installed and on your PATH.`))
      } else {
        reject(err)
      }
    })

    proc.on('close', (code, signal) => {
      clearTimeout(timer)
      if (killed) return

      if (signal) {
        reject(new Error(`${binary} was terminated by signal ${signal}`))
        return
      }

      if (code !== 0) {
        const errorOutput = stderr.trim() || stdout.trim()
        const detail = errorOutput.slice(-500) || '(no output)'
        console.error(`[CLI:stream] ${binary} exited with code ${code}: ${detail}`)
        reject(new Error(`${binary} exited with code ${code}: ${detail}`))
        return
      }

      console.log(`[CLI:stream] ${binary} completed successfully (${stdout.length} chars output)`)
      resolve(stdout)
    })

    if (stdinData !== null && stdinData !== undefined) {
      proc.stdin.write(stdinData)
      proc.stdin.end()
    } else {
      proc.stdin.end()
    }
  })
}

/**
 * Check if a CLI binary is available on PATH (synchronous).
 */
export function isCLIAvailable(binary: string): boolean {
  if (path.isAbsolute(binary)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { existsSync } = require('fs') as typeof import('fs')
      return existsSync(binary)
    } catch {
      return false
    }
  }

  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(cmd, [binary], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
