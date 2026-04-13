// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock edge-tts module before any imports
const mockEdgeTTS = vi.fn()
const mockGetVoices = vi.fn()

vi.mock('edge-tts', () => ({
  tts: (...args: unknown[]) => mockEdgeTTS(...args),
  getVoices: () => mockGetVoices(),
}))

// Mock fs to avoid actual file writes
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}))

// Mock tts-cache to avoid side effects between tests
const mockComputeSectionHash = vi.fn()
const mockGetCachedResult = vi.fn()
const mockSetCachedResult = vi.fn()

vi.mock('@main/services/tts/tts-cache', () => ({
  computeSectionHash: (...args: unknown[]) => mockComputeSectionHash(...args),
  getCachedResult: (...args: unknown[]) => mockGetCachedResult(...args),
  setCachedResult: (...args: unknown[]) => mockSetCachedResult(...args),
}))

import { EdgeTTSProvider } from '@main/services/tts/edge-tts-provider'
import type { VoiceProfile } from '@shared/types/tts'

function makeVoice(overrides: Partial<VoiceProfile> = {}): VoiceProfile {
  return {
    id: 'en-US-JennyNeural',
    name: 'Jenny (en-US)',
    provider: 'edge-tts',
    voiceId: 'en-US-JennyNeural',
    samples: [],
    isDefault: false,
    ...overrides,
  }
}

describe('EdgeTTSProvider', () => {
  let provider: EdgeTTSProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new EdgeTTSProvider()
    // Default: no cache hit
    mockGetCachedResult.mockReturnValue(null)
    mockComputeSectionHash.mockReturnValue('abc123hash')
  })

  describe('name', () => {
    it('returns "Edge TTS"', () => {
      expect(provider.name).toBe('Edge TTS')
    })
  })

  describe('isAvailable', () => {
    it('returns true (no binary or API key needed)', () => {
      expect(provider.isAvailable).toBe(true)
    })
  })

  describe('synthesize', () => {
    it('calls edge-tts with text and voice ID and returns a TTSSynthesisResult', async () => {
      const audioBuffer = Buffer.from('fake-audio-data')
      mockEdgeTTS.mockResolvedValue(audioBuffer)

      const voice = makeVoice()
      const result = await provider.synthesize('Hello world', voice)

      expect(mockEdgeTTS).toHaveBeenCalledWith('Hello world', { voice: 'en-US-JennyNeural' })
      expect(result).toMatchObject({
        filePath: expect.stringContaining('leonardo-tts-'),
        duration: expect.any(Number),
        sectionId: '',
      })
    })

    it('estimates duration from word count (150 wpm)', async () => {
      mockEdgeTTS.mockResolvedValue(Buffer.from('audio'))

      // 15 words → 15/150 * 60 * 1000 = 6000ms
      const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'
      const result = await provider.synthesize(text, makeVoice())

      expect(result.duration).toBeCloseTo(6000, -1) // within 100ms
    })

    it('returns cached result when cache hit', async () => {
      const cached = {
        filePath: '/tmp/cached.mp3',
        duration: 3000,
        sectionId: 'sec-1',
      }
      mockGetCachedResult.mockReturnValue(cached)

      const result = await provider.synthesize('hello', makeVoice())

      expect(result).toBe(cached)
      expect(mockEdgeTTS).not.toHaveBeenCalled()
    })

    it('caches result after successful synthesis', async () => {
      mockEdgeTTS.mockResolvedValue(Buffer.from('audio'))

      const voice = makeVoice()
      const result = await provider.synthesize('Hello', voice)

      expect(mockSetCachedResult).toHaveBeenCalledWith('abc123hash', result)
    })

    it('computes hash with text, voiceId, and engine', async () => {
      mockEdgeTTS.mockResolvedValue(Buffer.from('audio'))

      await provider.synthesize('Test text', makeVoice({ voiceId: 'en-US-AriaNeural' }))

      expect(mockComputeSectionHash).toHaveBeenCalledWith('Test text', 'en-US-AriaNeural', 'edge-tts')
    })

    it('wraps edge-tts errors with descriptive message', async () => {
      mockEdgeTTS.mockRejectedValue(new Error('network error'))

      await expect(provider.synthesize('hello', makeVoice())).rejects.toThrow(
        'Edge TTS synthesis failed: network error',
      )
    })

    it('throws when edge-tts returns empty buffer', async () => {
      mockEdgeTTS.mockResolvedValue(Buffer.alloc(0))

      await expect(provider.synthesize('hello', makeVoice())).rejects.toThrow(
        'Edge TTS returned empty audio buffer',
      )
    })
  })

  describe('getVoices', () => {
    it('returns VoiceProfile array mapped from edge-tts voices', async () => {
      mockGetVoices.mockResolvedValue([
        { ShortName: 'en-US-JennyNeural', FriendlyName: 'Microsoft Jenny Online (Natural) - English (United States)' },
        { ShortName: 'en-GB-RyanNeural', FriendlyName: 'Microsoft Ryan Online (Natural) - English (United Kingdom)' },
      ])

      const voices = await provider.getVoices()

      expect(voices).toHaveLength(2)
      expect(voices[0]).toEqual({
        id: 'en-US-JennyNeural',
        name: 'Microsoft Jenny Online (Natural) - English (United States)',
        provider: 'edge-tts',
        voiceId: 'en-US-JennyNeural',
        samples: [],
        isDefault: false,
      })
      expect(voices[1]).toEqual({
        id: 'en-GB-RyanNeural',
        name: 'Microsoft Ryan Online (Natural) - English (United Kingdom)',
        provider: 'edge-tts',
        voiceId: 'en-GB-RyanNeural',
        samples: [],
        isDefault: false,
      })
    })

    it('returns empty array when edge-tts returns no voices', async () => {
      mockGetVoices.mockResolvedValue([])

      const voices = await provider.getVoices()
      expect(voices).toEqual([])
    })

    it('rejects when getVoices throws', async () => {
      mockGetVoices.mockRejectedValue(new Error('service unavailable'))

      await expect(provider.getVoices()).rejects.toThrow('service unavailable')
    })
  })

  describe('testConnection', () => {
    it('returns true when getVoices succeeds', async () => {
      mockGetVoices.mockResolvedValue([{ ShortName: 'en-US-JennyNeural', FriendlyName: 'Jenny' }])

      const result = await provider.testConnection()
      expect(result).toBe(true)
    })

    it('returns false when getVoices throws', async () => {
      mockGetVoices.mockRejectedValue(new Error('network unreachable'))

      const result = await provider.testConnection()
      expect(result).toBe(false)
    })
  })
})
