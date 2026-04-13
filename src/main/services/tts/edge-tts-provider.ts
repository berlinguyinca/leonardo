import { join } from 'path'
import { tmpdir } from 'os'
import { statSync, readFileSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { ITTSProvider } from '@shared/interfaces/tts-provider'
import type { VoiceProfile, TTSSynthesisResult, WordTiming } from '@shared/types/tts'
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
    let metadataFilePath: string | null = null
    try {
      const tts = new MsEdgeTTS()
      await tts.setMetadata(voice.voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        wordBoundaryEnabled: true,
      })
      // Each call needs a unique directory — msedge-tts writes to a fixed filename (audio.mp3)
      const outputDir = join(tmpdir(), `leonardo-tts-${Date.now()}-${randomUUID().slice(0, 8)}`)
      mkdirSync(outputDir, { recursive: true })
      const fileResult = await tts.toFile(outputDir, text)
      audioFilePath = fileResult.audioFilePath
      metadataFilePath = fileResult.metadataFilePath ?? null
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

    let wordTimings: WordTiming[] = []
    let actualDuration = 0
    if (metadataFilePath) {
      try {
        const raw = readFileSync(metadataFilePath, 'utf-8')
        const parsed = JSON.parse(raw) as {
          Metadata: Array<{
            Type: string
            Data: { Offset: number; Duration: number; text: { Text: string } }
          }>
        }
        wordTimings = parsed.Metadata
          .filter((m) => m.Type === 'WordBoundary')
          .map((m) => ({
            text: m.Data.text.Text,
            offsetMs: m.Data.Offset / 10000,
            durationMs: m.Data.Duration / 10000,
          }))
        // Compute actual duration from last word boundary
        if (wordTimings.length > 0) {
          const last = wordTimings[wordTimings.length - 1]
          actualDuration = last.offsetMs + last.durationMs
        }
      } catch (err) {
        console.warn('[TTS] Failed to parse word boundary metadata:', err)
      }
    }

    // Use actual duration from word boundaries if available, otherwise estimate from word count
    const wordCount = text.split(/\s+/).length
    const estimatedDuration = (wordCount / 150) * 60 * 1000
    const duration = actualDuration > 0 ? actualDuration : estimatedDuration

    const result: TTSSynthesisResult = {
      filePath: audioFilePath,
      duration,
      sectionId: '',
      wordTimings,
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
