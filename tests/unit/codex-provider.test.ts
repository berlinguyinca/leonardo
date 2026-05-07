import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@main/services/ai/cli-runner', () => ({
  runCLI: vi.fn(),
  runCLIStreaming: vi.fn(),
  isCLIAvailable: vi.fn(),
}))

import { CodexProvider } from '@main/services/ai/codex-provider'
import { runCLI, runCLIStreaming, isCLIAvailable } from '@main/services/ai/cli-runner'

const mockRunCLI = vi.mocked(runCLI)
const mockRunCLIStreaming = vi.mocked(runCLIStreaming)
const mockIsCLIAvailable = vi.mocked(isCLIAvailable)

describe('CodexProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates with name "codex"', () => {
    const provider = new CodexProvider()
    expect(provider.name).toBe('codex')
  })

  it('testConnection returns true when codex CLI succeeds', async () => {
    mockRunCLI.mockResolvedValue({ stdout: 'OK', stderr: '' })
    const provider = new CodexProvider()
    const result = await provider.testConnection()
    expect(result).toBe(true)
  })

  it('testConnection returns false when codex CLI fails', async () => {
    mockRunCLI.mockRejectedValue(new Error('CLI not found'))
    const provider = new CodexProvider()
    const result = await provider.testConnection()
    expect(result).toBe(false)
  })

  it('generateScript calls runCLI with codex binary', async () => {
    mockRunCLI.mockResolvedValue({
      stdout: '1. Welcome to the tutorial.\n\n2. Click the button.',
      stderr: '',
    })

    const provider = new CodexProvider('o4-mini', 'codex')
    const script = await provider.generateScript('Describe this', {
      domEvents: [],
      recordingDuration: 10_000,
      url: 'https://example.com',
      userPrompt: 'Describe this',
    })

    expect(mockRunCLI).toHaveBeenCalled()
    expect(script.aiBackendUsed).toBe('codex')
    expect(script.sections.length).toBeGreaterThanOrEqual(1)
  })

  it('generateScriptStream calls runCLIStreaming and invokes onChunk', async () => {
    mockRunCLIStreaming.mockImplementation(async (_bin, _args, _stdin, onStdout) => {
      onStdout('1. Welcome')
      onStdout(' to the tutorial.')
      return '1. Welcome to the tutorial.'
    })

    const chunks: string[] = []
    const provider = new CodexProvider('o4-mini', 'codex')
    const script = await provider.generateScriptStream(
      'Describe this',
      {
        domEvents: [],
        recordingDuration: 10_000,
        url: 'https://example.com',
        userPrompt: 'Describe this',
      },
      (chunk) => chunks.push(chunk),
    )

    expect(mockRunCLIStreaming).toHaveBeenCalled()
    expect(chunks).toEqual(['1. Welcome', ' to the tutorial.'])
    expect(script.aiBackendUsed).toBe('codex')
  })

  it('isAvailable delegates to isCLIAvailable', () => {
    mockIsCLIAvailable.mockReturnValue(true)
    const provider = new CodexProvider()
    expect(provider.isAvailable).toBe(true)
    expect(mockIsCLIAvailable).toHaveBeenCalledWith('codex')
  })
})
