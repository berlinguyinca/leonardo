import { tmpdir } from 'os'
import { statSync } from 'fs'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { ITTSProvider } from '@shared/interfaces/tts-provider'
import type { VoiceProfile, TTSSynthesisResult } from '@shared/types/tts'
import { computeSectionHash, getCachedResult, setCachedResult } from './tts-cache'

export class EdgeTTSProvider implements ITTSProvider {
  readonly name = 'Edge TTS'

  get isAvailable(): boolean {
    return true // No binary or API key needed
  }

  async synthesize(text: string, voice: VoiceProfile): Promise<TTSSynthesisResult> {
    const hash = computeSectionHash(text, voice.voiceId, 'edge-tts')
    const cached = getCachedResult(hash)
    if (cached) return cached

    let audioFilePath: string
    try {
      const tts = new MsEdgeTTS()
      await tts.setMetadata(voice.voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
      const result = await tts.toFile(tmpdir(), text)
      audioFilePath = result.audioFilePath
      tts.close()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Edge TTS synthesis failed: ${message}`)
    }

    const fileSize = statSync(audioFilePath).size
    if (fileSize === 0) {
      throw new Error('Edge TTS returned empty audio file — synthesis produced no output')
    }

    console.log(`[TTS] Wrote ${fileSize} bytes to ${audioFilePath}`)

    // Estimate duration from text (150 words per minute)
    const wordCount = text.split(/\s+/).length
    const estimatedDuration = (wordCount / 150) * 60 * 1000

    const result: TTSSynthesisResult = {
      filePath: audioFilePath,
      duration: estimatedDuration,
      sectionId: '',
    }
    setCachedResult(hash, result)
    return result
  }

  async getVoices(): Promise<VoiceProfile[]> {
    const tts = new MsEdgeTTS()
    const voices = await tts.getVoices()
    return voices.map((v) => ({
      id: v.ShortName,
      name: v.FriendlyName,
      provider: 'edge-tts' as const,
      voiceId: v.ShortName,
      samples: [],
      isDefault: false,
    }))
  }

  async testConnection(): Promise<boolean> {
    try {
      const tts = new MsEdgeTTS()
      await tts.getVoices()
      return true
    } catch {
      return false
    }
  }
}
