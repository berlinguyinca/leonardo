import { IPC_CHANNELS } from '@shared/constants'
import { createTTSProvider } from '../services/tts'
import { assertTrustedIPCEvent } from './security'
import { safeHandle } from './safe-handle'
import type { TTSEngineType, VoiceProfile } from '@shared/types/tts'

const VALID_ENGINES = new Set<TTSEngineType>(['piper', 'coqui', 'elevenlabs', 'edge-tts'])

function isTTSEngine(value: unknown): value is TTSEngineType {
  return typeof value === 'string' && VALID_ENGINES.has(value as TTSEngineType)
}

function isVoiceProfile(value: unknown): value is VoiceProfile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.voiceId === 'string'
}

export function registerTTSIPC(): void {
  safeHandle(IPC_CHANNELS.TTS_SYNTHESIZE, async (event, args: unknown) => {
    assertTrustedIPCEvent(event)
    if (typeof args !== 'object' || args === null) {
      throw new Error('TTS_SYNTHESIZE: args must be an object')
    }
    const a = args as Record<string, unknown>
    if (typeof a.text !== 'string') {
      throw new Error('TTS_SYNTHESIZE: text must be a string')
    }
    if (!isVoiceProfile(a.voice)) {
      throw new Error('TTS_SYNTHESIZE: invalid voice profile')
    }
    if (!isTTSEngine(a.engine)) {
      throw new Error(`TTS_SYNTHESIZE: invalid engine "${String(a.engine)}"`)
    }
    const provider = createTTSProvider(a.engine)
    return provider.synthesize(a.text, a.voice)
  })

  safeHandle('tts:list-voices', async (event, engine: unknown) => {
    assertTrustedIPCEvent(event)
    if (!isTTSEngine(engine)) {
      throw new Error(`tts:list-voices: invalid engine "${String(engine)}"`)
    }
    const provider = createTTSProvider(engine)
    return provider.getVoices()
  })

  safeHandle('tts:test-connection', async (event, engine: unknown) => {
    assertTrustedIPCEvent(event)
    if (!isTTSEngine(engine)) {
      throw new Error(`tts:test-connection: invalid engine "${String(engine)}"`)
    }
    const provider = createTTSProvider(engine)
    return provider.testConnection()
  })
}
