import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@main/services/ai/cli-runner', () => ({
  runCLI: vi.fn(),
  runCLIStreaming: vi.fn(),
  isCLIAvailable: vi.fn(),
}))

import { ClaudeProvider } from '@main/services/ai/claude-provider'
import { runCLI, runCLIStreaming, isCLIAvailable } from '@main/services/ai/cli-runner'

const mockRunCLI = vi.mocked(runCLI)
const mockRunCLIStreaming = vi.mocked(runCLIStreaming)
const mockIsCLIAvailable = vi.mocked(isCLIAvailable)

describe('ClaudeProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates with name containing "Claude"', () => {
    const provider = new ClaudeProvider()
    expect(provider.name).toContain('Claude')
  })

  it('isAvailable delegates to isCLIAvailable with "claude"', () => {
    mockIsCLIAvailable.mockReturnValue(true)
    const provider = new ClaudeProvider()
    expect(provider.isAvailable).toBe(true)
    expect(mockIsCLIAvailable).toHaveBeenCalledWith('claude')
  })

  it('isAvailable returns false when CLI is not available', () => {
    mockIsCLIAvailable.mockReturnValue(false)
    const provider = new ClaudeProvider()
    expect(provider.isAvailable).toBe(false)
  })

  it('testConnection returns true when CLI succeeds with output', async () => {
    mockRunCLI.mockResolvedValue({ stdout: 'pong', stderr: '' })
    const provider = new ClaudeProvider()
    const result = await provider.testConnection()
    expect(result).toBe(true)
  })

  it('testConnection returns false when CLI throws', async () => {
    mockRunCLI.mockRejectedValue(new Error('CLI not found'))
    const provider = new ClaudeProvider()
    const result = await provider.testConnection()
    expect(result).toBe(false)
  })

  it('generateScript calls runCLI with --model and system prompt flags', async () => {
    mockRunCLI.mockResolvedValue({
      stdout: '1. Welcome to the tutorial.\n\n2. Click the button.',
      stderr: '',
    })

    const provider = new ClaudeProvider('claude-sonnet-4-20250514', 'claude')
    await provider.generateScript('Describe this', {
      domEvents: [],
      recordingDuration: 10_000,
      url: 'https://example.com',
      userPrompt: 'Describe this',
    })

    // Find the call whose args contain '--model' (not the testConnection ping call)
    const scriptCall = mockRunCLI.mock.calls.find(([, args]) => args.includes('--model'))
    expect(scriptCall).toBeDefined()
    const [, args] = scriptCall!
    expect(args).toContain('--model')
    expect(args).toContain('--system-prompt')
  })

  it('generateScript returns Script with aiBackendUsed: "claude"', async () => {
    mockRunCLI.mockResolvedValue({
      stdout: '1. Welcome to the tutorial.',
      stderr: '',
    })

    const provider = new ClaudeProvider()
    const script = await provider.generateScript('Describe this', {
      domEvents: [],
      recordingDuration: 10_000,
      url: 'https://example.com',
      userPrompt: 'Describe this',
    })

    expect(script.aiBackendUsed).toBe('claude')
  })

  it('generateScript parses sections from response text', async () => {
    mockRunCLI.mockResolvedValue({
      stdout: '1. First section.\n\n2. Second section.',
      stderr: '',
    })

    const provider = new ClaudeProvider()
    const script = await provider.generateScript('Describe this', {
      domEvents: [],
      recordingDuration: 10_000,
      url: 'https://example.com',
      userPrompt: 'Describe this',
    })

    expect(script.sections.length).toBeGreaterThanOrEqual(1)
  })

  it('generateScriptStream calls runCLIStreaming and invokes onChunk callback', async () => {
    mockRunCLIStreaming.mockImplementation(async (_bin, _args, _stdin, onStdout) => {
      onStdout('1. Welcome')
      onStdout(' to the tutorial.')
      return '1. Welcome to the tutorial.'
    })

    const chunks: string[] = []
    const provider = new ClaudeProvider()
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
    expect(script.aiBackendUsed).toBe('claude')
  })

  it('refineSyncPoints returns parsed sync points from JSON response', async () => {
    const syncPointJson = JSON.stringify([
      { timestamp: 1000, type: 'freeze', duration: 500, confidence: 0.9 },
      { timestamp: 3000, type: 'zoom', duration: 300, confidence: 0.8 },
    ])
    mockRunCLI.mockResolvedValue({ stdout: syncPointJson, stderr: '' })

    const provider = new ClaudeProvider()
    const script = {
      id: 'test-id',
      projectId: '',
      sections: [{ id: 's1', text: 'Hello world', startTime: 0, endTime: 2000 }],
      aiBackendUsed: 'claude' as const,
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    }
    const points = await provider.refineSyncPoints(script, [])

    expect(points).toHaveLength(2)
    expect(points[0].timestamp).toBe(1000)
    expect(points[0].type).toBe('freeze')
    expect(points[1].type).toBe('zoom')
  })

  it('refineSyncPoints returns empty array on parse error', async () => {
    mockRunCLI.mockResolvedValue({ stdout: 'not valid json', stderr: '' })

    const provider = new ClaudeProvider()
    const script = {
      id: 'test-id',
      projectId: '',
      sections: [],
      aiBackendUsed: 'claude' as const,
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    }
    const points = await provider.refineSyncPoints(script, [])

    expect(points).toEqual([])
  })
})
