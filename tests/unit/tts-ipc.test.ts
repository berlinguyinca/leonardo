// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mock electron before any source imports ----
const mockIpcHandlers: Map<string, Function> = new Map()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Function) => {
      mockIpcHandlers.set(channel, handler)
    },
  },
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

// Mock the TTS provider factory
const mockSynthesize = vi.fn()
const mockGetVoices = vi.fn()
const mockTestConnection = vi.fn()

vi.mock('@main/services/tts', () => ({
  createTTSProvider: vi.fn(() => ({
    synthesize: (...args: unknown[]) => mockSynthesize(...args),
    getVoices: () => mockGetVoices(),
    testConnection: () => mockTestConnection(),
  })),
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    TTS_SYNTHESIZE: 'tts:synthesize',
  },
}))

import { registerTTSIPC } from '@main/ipc/tts.ipc'
import { createTTSProvider } from '@main/services/tts'

const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: { getURL: () => 'file:///renderer/index.html' },
}

async function invokeHandle(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, ...args)
}

describe('TTS IPC handlers', () => {
  beforeEach(() => {
    mockIpcHandlers.clear()
    vi.clearAllMocks()
    registerTTSIPC()
  })

  describe('handler registration', () => {
    it('registers handler for tts:synthesize', () => {
      expect(mockIpcHandlers.has('tts:synthesize')).toBe(true)
    })

    it('registers handler for tts:list-voices', () => {
      expect(mockIpcHandlers.has('tts:list-voices')).toBe(true)
    })

    it('registers handler for tts:test-connection', () => {
      expect(mockIpcHandlers.has('tts:test-connection')).toBe(true)
    })
  })

  describe('tts:synthesize', () => {
    it('delegates to provider.synthesize and returns the result', async () => {
      const synthesisResult = {
        filePath: '/tmp/leonardo-tts-12345.mp3',
        duration: 3000,
        sectionId: '',
      }
      mockSynthesize.mockResolvedValue(synthesisResult)

      const voice = { id: 'jenny', name: 'Jenny', provider: 'edge-tts', voiceId: 'en-US-JennyNeural', samples: [], isDefault: false }
      const args = { text: 'Hello world', voice, engine: 'edge-tts' }

      const result = await invokeHandle('tts:synthesize', args)

      expect(mockSynthesize).toHaveBeenCalledWith('Hello world', voice)
      expect(result).toEqual(synthesisResult)
    })

    it('creates provider from engine argument', async () => {
      mockSynthesize.mockResolvedValue({ filePath: '/tmp/out.mp3', duration: 1000, sectionId: '' })

      const args = {
        text: 'Test',
        voice: { id: 'v1', name: 'Voice', provider: 'piper', voiceId: 'en-us', samples: [], isDefault: false },
        engine: 'piper',
      }

      await invokeHandle('tts:synthesize', args)

      expect(createTTSProvider).toHaveBeenCalledWith('piper')
    })

    it('rejects (re-throws) when provider.synthesize throws', async () => {
      mockSynthesize.mockRejectedValue(new Error('synthesis failed'))

      const args = {
        text: 'hello',
        voice: { id: 'v1', name: 'Voice', provider: 'edge-tts', voiceId: 'en-US-JennyNeural', samples: [], isDefault: false },
        engine: 'edge-tts',
      }

      await expect(invokeHandle('tts:synthesize', args)).rejects.toThrow('synthesis failed')
    })
  })

  describe('tts:list-voices', () => {
    it('delegates to provider.getVoices and returns the result', async () => {
      const voices = [
        { id: 'en-US-JennyNeural', name: 'Jenny', provider: 'edge-tts', voiceId: 'en-US-JennyNeural', samples: [], isDefault: false },
        { id: 'en-GB-RyanNeural', name: 'Ryan', provider: 'edge-tts', voiceId: 'en-GB-RyanNeural', samples: [], isDefault: false },
      ]
      mockGetVoices.mockResolvedValue(voices)

      const result = await invokeHandle('tts:list-voices', 'edge-tts')

      expect(mockGetVoices).toHaveBeenCalled()
      expect(result).toEqual(voices)
    })

    it('creates provider from engine argument', async () => {
      mockGetVoices.mockResolvedValue([])

      await invokeHandle('tts:list-voices', 'piper')

      expect(createTTSProvider).toHaveBeenCalledWith('piper')
    })

    it('rejects when provider.getVoices throws', async () => {
      mockGetVoices.mockRejectedValue(new Error('voices fetch failed'))

      await expect(invokeHandle('tts:list-voices', 'edge-tts')).rejects.toThrow('voices fetch failed')
    })
  })

  describe('tts:test-connection', () => {
    it('returns true when provider.testConnection succeeds', async () => {
      mockTestConnection.mockResolvedValue(true)

      const result = await invokeHandle('tts:test-connection', 'edge-tts')

      expect(mockTestConnection).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('returns false when provider.testConnection returns false', async () => {
      mockTestConnection.mockResolvedValue(false)

      const result = await invokeHandle('tts:test-connection', 'piper')

      expect(result).toBe(false)
    })

    it('creates provider from engine argument', async () => {
      mockTestConnection.mockResolvedValue(true)

      await invokeHandle('tts:test-connection', 'elevenlabs')

      expect(createTTSProvider).toHaveBeenCalledWith('elevenlabs')
    })

    it('rejects when provider.testConnection throws', async () => {
      mockTestConnection.mockRejectedValue(new Error('connection error'))

      await expect(invokeHandle('tts:test-connection', 'edge-tts')).rejects.toThrow('connection error')
    })
  })
})
