// tests/unit/cli-runner.test.ts
import { describe, it, expect } from 'vitest'
import { runCLI, isCLIAvailable } from '@main/services/ai/cli-runner'

describe('isCLIAvailable', () => {
  it('returns true for a binary that exists (node)', () => {
    expect(isCLIAvailable('node')).toBe(true)
  })

  it('returns false for a binary that does not exist', () => {
    expect(isCLIAvailable('nonexistent-binary-xyz-123')).toBe(false)
  })
})

describe('runCLI', () => {
  it('captures stdout from a simple command', async () => {
    const result = await runCLI('echo', ['hello'])
    expect(result.stdout.trim()).toBe('hello')
  })

  it('pipes stdin data to the process', async () => {
    const result = await runCLI('cat', [], 'piped input')
    expect(result.stdout).toBe('piped input')
  })

  it('rejects when binary is not found', async () => {
    await expect(runCLI('nonexistent-binary-xyz-123', [])).rejects.toThrow('not found')
  })

  it('rejects on non-zero exit code', async () => {
    await expect(runCLI('false', [])).rejects.toThrow('exited with code')
  })

  it('rejects on timeout', async () => {
    await expect(runCLI('sleep', ['10'], undefined, 100)).rejects.toThrow('timed out')
  })
})
