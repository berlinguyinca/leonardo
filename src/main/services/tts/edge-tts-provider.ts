import { join } from 'path'
import { tmpdir } from 'os'
import { tts as edgeTTS, getVoices as edgeGetVoices } from 'edge-tts'
import { writeFileSync } from 'fs'
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

    const outputPath = join(tmpdir(), `leonardo-tts-${Date.now()}-${voice.voiceId}.mp3`)

    let audioBuffer: Buffer
    try {
      audioBuffer = await edgeTTS(text, { voice: voice.voiceId })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Edge TTS synthesis failed: ${message}`)
    }

    if (audioBuffer.length === 0) {
      throw new Error('Edge TTS returned empty audio buffer — synthesis produced no output')
    }

    writeFileSync(outputPath, audioBuffer)
    console.log(`[TTS] Wrote ${audioBuffer.length} bytes to ${outputPath}`)

    // Estimate duration from text (150 words per minute)
    const wordCount = text.split(/\s+/).length
    const estimatedDuration = (wordCount / 150) * 60 * 1000

    const result: TTSSynthesisResult = {
      filePath: outputPath,
      duration: estimatedDuration,
      sectionId: '',
    }
    setCachedResult(hash, result)
    return result
  }

  async getVoices(): Promise<VoiceProfile[]> {
    const voices = await edgeGetVoices()
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
      await edgeGetVoices()
      return true
    } catch {
      return false
    }
  }
}
