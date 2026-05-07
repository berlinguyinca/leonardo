import type { ITTSProvider } from '@shared/interfaces/tts-provider'
import type { TTSEngineType } from '@shared/types/tts'
import { PiperProvider } from './piper-provider'
import { ElevenLabsProvider } from './elevenlabs-provider'
import { EdgeTTSProvider } from './edge-tts-provider'

export function createTTSProvider(engine: TTSEngineType, config: { apiKey?: string; binaryPath?: string; modelsDir?: string } = {}): ITTSProvider {
  switch (engine) {
    case 'piper':
      return new PiperProvider(config.binaryPath, config.modelsDir)
    case 'elevenlabs':
      return new ElevenLabsProvider(config.apiKey ?? '')
    case 'edge-tts':
      return new EdgeTTSProvider()
    case 'coqui':
      // Coqui is listed as optional — use Piper as fallback
      return new PiperProvider(config.binaryPath, config.modelsDir)
    default:
      throw new Error(`Unknown TTS engine: ${engine}`)
  }
}

export { PiperProvider } from './piper-provider'
export { ElevenLabsProvider } from './elevenlabs-provider'
export { EdgeTTSProvider } from './edge-tts-provider'
export { computeSectionHash, getCachedResult, setCachedResult, clearCache, getCacheSize } from './tts-cache'
