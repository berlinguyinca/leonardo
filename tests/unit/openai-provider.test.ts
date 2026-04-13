import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@main/services/ai/cli-runner', () => ({
  runCLI: vi.fn(),
  runCLIStreaming: vi.fn(),
  isCLIAvailable: vi.fn(),
}))

// Stub process.platform to ensure the non-Windows code path runs
vi.stubGlobal('process', { ...process, platform: 'linux' })

import { OpenAIProvider } from '@main/services/ai/openai-provider'
import { runCLI, isCLIAvailable } from '@main/services/ai/cli-runner'

const mockRunCLI = vi.mocked(runCLI)
const mockIsCLIAvailable = vi.mocked(isCLIAvailable)

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates with name containing "OpenAI"', () => {
    const provider = new OpenAIProvider()
    expect(provider.name).toContain('OpenAI')
  })

  it('isAvailable delegates to isCLIAvailable', () => {
    mockIsCLIAvailable.mockReturnValue(true)
    const provider = new OpenAIProvider()
    expect(provider.isAvailable).toBe(true)
    expect(mockIsCLIAvailable).toHaveBeenCalledWith('codex')
  })

  it('isAvailable returns false when CLI is not available', () => {
    mockIsCLIAvailable.mockReturnValue(false)
    const provider = new OpenAIProvider()
    expect(provider.isAvailable).toBe(false)
  })

  it('testConnection returns true when CLI succeeds', async () => {
    mockRunCLI.mockResolvedValue({ stdout: 'OK', stderr: '' })
    const provider = new OpenAIProvider()
    const result = await provider.testConnection()
    expect(result).toBe(true)
  })

  it('testConnection returns false when CLI throws', async () => {
    mockRunCLI.mockRejectedValue(new Error('CLI not found'))
    const provider = new OpenAIProvider()
    const result = await provider.testConnection()
    expect(result).toBe(false)
  })

  it('generateScript calls runCLI with codex binary args', async () => {
    mockRunCLI.mockResolvedValue({
      stdout: '1. Welcome to the tutorial.',
      stderr: '',
    })

    const provider = new OpenAIProvider('gpt-4o', 'codex')
    await provider.generateScript('Describe this', {
      domEvents: [],
      recordingDuration: 10_000,
      url: 'https://example.com',
      userPrompt: 'Describe this',
    })

    expect(mockRunCLI).toHaveBeenCalledWith(
      'codex',
      expect.arrayContaining(['exec', '--sandbox', 'read-only', '-m', 'gpt-4o']),
      expect.stringContaining('Describe this'),
      undefined,
    )
  })

  it('generateScript returns Script with aiBackendUsed: "openai"', async () => {
    mockRunCLI.mockResolvedValue({
      stdout: '1. Welcome to the tutorial.',
      stderr: '',
    })

    const provider = new OpenAIProvider()
    const script = await provider.generateScript('Describe this', {
      domEvents: [],
      recordingDuration: 10_000,
      url: 'https://example.com',
      userPrompt: 'Describe this',
    })

    expect(script.aiBackendUsed).toBe('openai')
  })

  it('refineSyncPoints returns parsed sync points', async () => {
    const syncPointJson = JSON.stringify([
      { timestamp: 2000, type: 'annotation', duration: 400, confidence: 0.85 },
    ])
    mockRunCLI.mockResolvedValue({ stdout: syncPointJson, stderr: '' })

    const provider = new OpenAIProvider()
    const script = {
      id: 'test-id',
      projectId: '',
      sections: [{ id: 's1', text: 'Hello world', startTime: 0, endTime: 3000 }],
      aiBackendUsed: 'openai' as const,
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    }
    const points = await provider.refineSyncPoints(script, [])

    expect(points).toHaveLength(1)
    expect(points[0].timestamp).toBe(2000)
    expect(points[0].type).toBe('annotation')
  })

  it('refineSyncPoints returns empty array on parse failure', async () => {
    mockRunCLI.mockResolvedValue({ stdout: 'not valid json', stderr: '' })

    const provider = new OpenAIProvider()
    const script = {
      id: 'test-id',
      projectId: '',
      sections: [],
      aiBackendUsed: 'openai' as const,
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    }
    const points = await provider.refineSyncPoints(script, [])

    expect(points).toEqual([])
  })
})
