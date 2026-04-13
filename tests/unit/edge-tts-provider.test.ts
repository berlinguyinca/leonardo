// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron app module
vi.mock("electron", () => ({
  app: { getPath: () => "/tmp/test-userData" },
}))

// Mock msedge-tts MsEdgeTTS class
const mockSetMetadata = vi.fn()
const mockToFile = vi.fn()
const mockGetVoices = vi.fn()
const mockClose = vi.fn()

vi.mock('msedge-tts', () => ({
  MsEdgeTTS: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.setMetadata = mockSetMetadata
    this.toFile = mockToFile
    this.getVoices = mockGetVoices
    this.close = mockClose
  }),
  OUTPUT_FORMAT: {
    AUDIO_24KHZ_48KBITRATE_MONO_MP3: 'audio-24khz-48kbitrate-mono-mp3',
    AUDIO_24KHZ_96KBITRATE_MONO_MP3: 'audio-24khz-96kbitrate-mono-mp3',
    WEBM_24KHZ_16BIT_MONO_OPUS: 'webm-24khz-16bit-mono-opus',
  },
}))

// Mock fs to avoid actual file system checks
vi.mock('fs', () => ({
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
  readFileSync: vi.fn().mockReturnValue(
    '{"Metadata":[{"Type":"WordBoundary","Data":{"Offset":0,"Duration":3750000,"text":{"Text":"Hello"}}},{"Type":"WordBoundary","Data":{"Offset":5000000,"Duration":3750000,"text":{"Text":"world"}}}]}',
  ),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
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
    // Default: toFile returns a valid path and metadata file
    mockSetMetadata.mockResolvedValue(undefined)
    mockToFile.mockResolvedValue({ audioFilePath: '/tmp/leonardo-tts-123.mp3', metadataFilePath: '/tmp/leonardo-tts-123.json' })
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
    it('calls MsEdgeTTS setMetadata and toFile, returns TTSSynthesisResult', async () => {
      const voice = makeVoice()
      const result = await provider.synthesize('Hello world', voice)

      expect(mockSetMetadata).toHaveBeenCalledWith(
        'en-US-JennyNeural',
        'audio-24khz-48kbitrate-mono-mp3',
        { wordBoundaryEnabled: true },
      )
      expect(mockToFile).toHaveBeenCalled()
      expect(mockClose).toHaveBeenCalled()
      expect(result).toMatchObject({
        filePath: '/tmp/leonardo-tts-123.mp3',
        duration: expect.any(Number),
        sectionId: '',
      })
    })

    it('parses word boundary metadata and returns wordTimings', async () => {
      const result = await provider.synthesize('Hello world', makeVoice())

      expect(result.wordTimings).toEqual([
        { text: 'Hello', offsetMs: 0, durationMs: 375 },
        { text: 'world', offsetMs: 500, durationMs: 375 },
      ])
    })

    it('uses actual duration from last word boundary when metadata present', async () => {
      const result = await provider.synthesize('Hello world', makeVoice())
      // Last word: offsetMs=500, durationMs=375 → actualDuration=875
      expect(result.duration).toBe(875)
    })

    it('falls back to word-count estimate when metadataFilePath is null', async () => {
      mockToFile.mockResolvedValueOnce({ audioFilePath: '/tmp/leonardo-tts-123.mp3', metadataFilePath: null })
      // 15 words → 6000ms
      const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'
      const result = await provider.synthesize(text, makeVoice())
      expect(result.duration).toBeCloseTo(6000, -1)
      expect(result.wordTimings).toEqual([])
    })

    it('falls back to word-count estimate when metadata parse fails', async () => {
      const { readFileSync } = await import('fs')
      ;(readFileSync as ReturnType<typeof vi.fn>).mockReturnValueOnce('not valid json')
      const text = 'one two three four five'
      const result = await provider.synthesize(text, makeVoice())
      // 5 words → 5/150 * 60 * 1000 = 2000ms
      expect(result.duration).toBeCloseTo(2000, -1)
      expect(result.wordTimings).toEqual([])
    })

    it('estimates duration from word count (150 wpm) when no metadata available', async () => {
      mockToFile.mockResolvedValueOnce({ audioFilePath: '/tmp/leonardo-tts-123.mp3', metadataFilePath: null })
      // 15 words → 15/150 * 60 * 1000 = 6000ms
      const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'
      const result = await provider.synthesize(text, makeVoice())

      expect(result.duration).toBeCloseTo(6000, -1)
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
      expect(mockSetMetadata).not.toHaveBeenCalled()
    })

    it('caches result after successful synthesis', async () => {
      const voice = makeVoice()
      const result = await provider.synthesize('Hello', voice)

      expect(mockSetCachedResult).toHaveBeenCalledWith('abc123hash', result)
    })

    it('computes hash with text, voiceId, and engine', async () => {
      await provider.synthesize('Test text', makeVoice({ voiceId: 'en-US-AriaNeural' }))

      expect(mockComputeSectionHash).toHaveBeenCalledWith('Test text', 'en-US-AriaNeural', 'edge-tts')
    })

    it('wraps MsEdgeTTS errors with descriptive message', async () => {
      mockSetMetadata.mockRejectedValue(new Error('Unexpected server response: 403'))

      await expect(provider.synthesize('hello', makeVoice())).rejects.toThrow(
        'Edge TTS synthesis failed: Unexpected server response: 403',
      )
    })

    it('throws when audio file is empty', async () => {
      const { statSync } = await import('fs')
      ;(statSync as ReturnType<typeof vi.fn>).mockReturnValueOnce({ size: 0 })

      await expect(provider.synthesize('hello', makeVoice())).rejects.toThrow(
        'Edge TTS returned empty audio file',
      )
    })
  })

  describe('getVoices', () => {
    it('returns VoiceProfile array mapped from MsEdgeTTS voices', async () => {
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
    })

    it('returns empty array when no voices available', async () => {
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
      expect(await provider.testConnection()).toBe(true)
    })

    it('returns false when getVoices throws', async () => {
      mockGetVoices.mockRejectedValue(new Error('network unreachable'))
      expect(await provider.testConnection()).toBe(false)
    })
  })
})
