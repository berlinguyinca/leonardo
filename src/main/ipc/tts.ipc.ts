import { IPC_CHANNELS } from '@shared/constants'
import { createTTSProvider } from '../services/tts'
import { assertTrustedIPCEvent } from './security'
import { safeHandle } from './safe-handle'
import type { TTSEngineType, VoiceProfile } from '@shared/types/tts'

export function registerTTSIPC(): void {
  safeHandle(IPC_CHANNELS.TTS_SYNTHESIZE, async (event, args: unknown) => {
    assertTrustedIPCEvent(event)
    const { text, voice, engine } = args as { text: string; voice: VoiceProfile; engine: TTSEngineType }
    const provider = createTTSProvider(engine)
    return provider.synthesize(text, voice)
  })

  safeHandle('tts:list-voices', async (event, engine: unknown) => {
    assertTrustedIPCEvent(event)
    const provider = createTTSProvider(engine as TTSEngineType)
    return provider.getVoices()
  })

  safeHandle('tts:test-connection', async (event, engine: unknown) => {
    assertTrustedIPCEvent(event)
    const provider = createTTSProvider(engine as TTSEngineType)
    return provider.testConnection()
  })
}
