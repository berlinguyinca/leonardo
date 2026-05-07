import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IPC_CHANNELS } from '@shared/constants'

// Mock electron
const mockHandle = vi.fn()
vi.mock('electron', () => ({
  ipcMain: { handle: (...args: unknown[]) => mockHandle(...args) },
}))

// Mock security
vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

// Mock project-store
vi.mock('@main/services/project-store', () => ({
  saveScript: vi.fn((script: unknown) => script),
  listScriptsByProject: vi.fn().mockReturnValue([]),
}))

// Mock AI module
const mockGenerateScript = vi.fn()
const mockGenerateScriptStream = vi.fn()
vi.mock('@main/services/ai', () => ({
  createAIProvider: vi.fn(() => ({
    generateScript: mockGenerateScript,
    generateScriptStream: mockGenerateScriptStream,
  })),
}))

import { registerAIIPC } from '@main/ipc/ai.ipc'

describe('streaming IPC', () => {
  let handlers: Record<string, (...args: unknown[]) => Promise<unknown>>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = handler
    })
    registerAIIPC()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const makeSender = () => ({
    send: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    getURL: () => 'file://test',
  })

  const makeEvent = () => {
    const sender = makeSender()
    return {
      sender,
      senderFrame: { url: 'file://test' },
    }
  }

  const baseArgs = {
    config: { provider: 'claude' as const, mode: 'cloud' as const },
    prompt: 'Generate a test script',
    context: {
      domEvents: [],
      recordingDuration: 5000,
      url: 'https://example.com',
      userPrompt: 'test',
    },
    projectId: 'proj-1',
  }

  it('registers the streaming IPC channel', () => {
    expect(handlers[IPC_CHANNELS.AI_GENERATE_SCRIPT_STREAM]).toBeDefined()
  })

  it('sends chunks via event.sender.send during streaming', async () => {
    const event = makeEvent()
    const mockScript = {
      id: 's1',
      projectId: '',
      sections: [],
      aiBackendUsed: 'claude',
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    }

    mockGenerateScriptStream.mockImplementation(
      async (_prompt: string, _ctx: unknown, onChunk: (chunk: string) => void) => {
        onChunk('Hello ')
        onChunk('world')
        return mockScript
      },
    )

    const handler = handlers[IPC_CHANNELS.AI_GENERATE_SCRIPT_STREAM]
    const result = await handler(event, baseArgs) as { success: boolean }

    expect(result.success).toBe(true)
    expect(event.sender.send).toHaveBeenCalledWith(IPC_CHANNELS.AI_STREAM_CHUNK, 'Hello ')
    expect(event.sender.send).toHaveBeenCalledWith(IPC_CHANNELS.AI_STREAM_CHUNK, 'world')
    expect(event.sender.send).toHaveBeenCalledWith(IPC_CHANNELS.AI_STREAM_DONE, expect.any(Object))
  })

  it('guards against destroyed sender when sending chunks', async () => {
    const event = makeEvent()
    event.sender.isDestroyed.mockReturnValue(true)

    const mockScript = {
      id: 's2',
      projectId: '',
      sections: [],
      aiBackendUsed: 'claude',
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    }

    mockGenerateScriptStream.mockImplementation(
      async (_prompt: string, _ctx: unknown, onChunk: (chunk: string) => void) => {
        onChunk('data')
        return mockScript
      },
    )

    const handler = handlers[IPC_CHANNELS.AI_GENERATE_SCRIPT_STREAM]
    await handler(event, baseArgs)

    // sender.send should NOT have been called since isDestroyed returns true
    expect(event.sender.send).not.toHaveBeenCalled()
  })

  it('sends detailed error on failure', async () => {
    const event = makeEvent()
    mockGenerateScriptStream.mockRejectedValue(new Error('Connection refused'))

    const handler = handlers[IPC_CHANNELS.AI_GENERATE_SCRIPT_STREAM]
    const result = await handler(event, baseArgs) as { success: boolean; error: string }

    expect(result.success).toBe(false)
    expect(result.error).toBe('Connection refused')
    expect(event.sender.send).toHaveBeenCalledWith(
      IPC_CHANNELS.AI_STREAM_ERROR,
      expect.objectContaining({
        error: 'Connection refused',
        provider: 'claude',
        timestamp: expect.any(Number),
      }),
    )
  })

  it('falls back to non-streaming when generateScriptStream is not available', async () => {
    const event = makeEvent()

    // Override provider to not have generateScriptStream
    const { createAIProvider } = await import('@main/services/ai')
    const mockedCreate = vi.mocked(createAIProvider)
    const mockScript = {
      id: 's3',
      projectId: '',
      sections: [],
      aiBackendUsed: 'claude',
      prompt: 'test',
      generatedAt: new Date().toISOString(),
    }
    mockedCreate.mockReturnValueOnce({
      name: 'test',
      isAvailable: true,
      generateScript: vi.fn().mockResolvedValue(mockScript),
      generateScriptStream: undefined,
      refineSyncPoints: vi.fn().mockResolvedValue([]),
      testConnection: vi.fn().mockResolvedValue(true),
    })

    const handler = handlers[IPC_CHANNELS.AI_GENERATE_SCRIPT_STREAM]
    const result = await handler(event, baseArgs) as { success: boolean }

    expect(result.success).toBe(true)
    expect(event.sender.send).toHaveBeenCalledWith(IPC_CHANNELS.AI_STREAM_DONE, expect.any(Object))
  })
})
