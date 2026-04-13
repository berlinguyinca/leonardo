import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    writeFileSync: vi.fn(),
  }
})

import { ElevenLabsProvider } from '@main/services/tts/elevenlabs-provider'
import { writeFileSync } from 'fs'
import type { VoiceProfile } from '@shared/types/tts'

const mockWriteFileSync = vi.mocked(writeFileSync)

function makeVoice(voiceId = 'voice-abc'): VoiceProfile {
  return { id: voiceId, name: 'Rachel', provider: 'elevenlabs', voiceId, samples: [], isDefault: false }
}

function makeOkResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => Buffer.from('audio-data').buffer,
    json: async () => body,
  }
}

describe('ElevenLabsProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('isAvailable returns true when apiKey is non-empty', () => {
    const provider = new ElevenLabsProvider('sk-test-key')
    expect(provider.isAvailable).toBe(true)
  })

  it('isAvailable returns false when apiKey is empty string', () => {
    const provider = new ElevenLabsProvider('')
    expect(provider.isAvailable).toBe(false)
  })

  it('synthesize calls ElevenLabs API with correct headers and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    mockWriteFileSync.mockReturnValue(undefined)

    const provider = new ElevenLabsProvider('sk-api-key')
    await provider.synthesize('Hello world', makeVoice('voice-abc'))

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/voice-abc',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'xi-api-key': 'sk-api-key',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('Hello world'),
      }),
    )
  })

  it('synthesize writes audio buffer to output file', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    mockWriteFileSync.mockReturnValue(undefined)

    const provider = new ElevenLabsProvider('sk-api-key')
    const result = await provider.synthesize('Hello world', makeVoice('voice-abc'))

    expect(mockWriteFileSync).toHaveBeenCalledWith(result.filePath, expect.any(Buffer))
    expect(result.filePath).toContain('.mp3')
    expect(result.duration).toBeGreaterThan(0)
  })

  it('synthesize throws on API error response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ElevenLabsProvider('sk-bad-key')
    await expect(provider.synthesize('Hello', makeVoice())).rejects.toThrow('ElevenLabs API error')
  })

  it('getVoices returns voice profiles from API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        voices: [
          { voice_id: 'v1', name: 'Rachel', labels: {} },
          { voice_id: 'v2', name: 'Josh', labels: {} },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ElevenLabsProvider('sk-api-key')
    const voices = await provider.getVoices()

    expect(voices).toHaveLength(2)
    expect(voices[0].voiceId).toBe('v1')
    expect(voices[0].name).toBe('Rachel')
    expect(voices[0].provider).toBe('elevenlabs')
    expect(voices[1].name).toBe('Josh')
  })

  it('getVoices returns empty array on API error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ElevenLabsProvider('sk-api-key')
    const voices = await provider.getVoices()
    expect(voices).toEqual([])
  })

  it('getVoices returns empty array when voices key is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ElevenLabsProvider('sk-api-key')
    const voices = await provider.getVoices()
    expect(voices).toEqual([])
  })
})
