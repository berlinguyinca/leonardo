import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@main/services/tts/piper-provider', () => ({
  PiperProvider: vi.fn(function (this: { name: string }) { this.name = 'Piper' }),
}))

vi.mock('@main/services/tts/elevenlabs-provider', () => ({
  ElevenLabsProvider: vi.fn(function (this: { name: string }) { this.name = 'ElevenLabs' }),
}))

import { createTTSProvider } from '@main/services/tts/index'
import { PiperProvider } from '@main/services/tts/piper-provider'
import { ElevenLabsProvider } from '@main/services/tts/elevenlabs-provider'

const MockPiperProvider = vi.mocked(PiperProvider)
const MockElevenLabsProvider = vi.mocked(ElevenLabsProvider)

describe('createTTSProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates PiperProvider for engine "piper"', () => {
    const provider = createTTSProvider('piper', { binaryPath: '/bin/piper', modelsDir: '/models' })
    expect(MockPiperProvider).toHaveBeenCalledWith('/bin/piper', '/models')
    expect(provider.name).toBe('Piper')
  })

  it('creates ElevenLabsProvider for engine "elevenlabs"', () => {
    const provider = createTTSProvider('elevenlabs', { apiKey: 'sk-test' })
    expect(MockElevenLabsProvider).toHaveBeenCalledWith('sk-test')
    expect(provider.name).toBe('ElevenLabs')
  })

  it('creates PiperProvider for engine "coqui" (fallback)', () => {
    const provider = createTTSProvider('coqui', { binaryPath: '/bin/piper' })
    expect(MockPiperProvider).toHaveBeenCalledWith('/bin/piper', undefined)
    expect(provider.name).toBe('Piper')
  })

  it('passes config through to constructors (apiKey defaults to empty string)', () => {
    createTTSProvider('elevenlabs', {})
    expect(MockElevenLabsProvider).toHaveBeenCalledWith('')
  })

  it('throws for unknown engine type', () => {
    expect(() => createTTSProvider('unknown' as any)).toThrow('Unknown TTS engine')
  })
})
