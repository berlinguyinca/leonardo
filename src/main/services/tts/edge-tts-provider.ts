import { join } from 'path'
import { app } from 'electron'
import { statSync, readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'
import type { ITTSProvider } from '@shared/interfaces/tts-provider'
import type { VoiceProfile, TTSSynthesisResult, WordTiming } from '@shared/types/tts'
import { computeSectionHash, getCachedResult, setCachedResult } from './tts-cache'

/** Persistent voiceover directory inside app userData — survives restarts */
function getVoiceoverDir(): string {
  const dir = join(app.getPath('userData'), 'voiceovers')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Parse msedge-tts word boundary metadata file (if it exists) */
function parseWordTimings(metadataFilePath: string | null): { timings: WordTiming[]; actualDuration: number } {
  if (!metadataFilePath || !existsSync(metadataFilePath)) {
    return { timings: [], actualDuration: 0 }
  }
  try {
    const raw = readFileSync(metadataFilePath, 'utf-8')
    const parsed = JSON.parse(raw) as {
      Metadata: Array<{
        Type: string
        Data: { Offset: number; Duration: number; text: { Text: string } }
      }>
    }
    const timings = parsed.Metadata
      .filter((m) => m.Type === 'WordBoundary')
      .map((m) => ({
        text: m.Data.text.Text,
        offsetMs: m.Data.Offset / 10000,
        durationMs: m.Data.Duration / 10000,
      }))
    const last = timings[timings.length - 1]
    const actualDuration = last ? last.offsetMs + last.durationMs : 0
    return { timings, actualDuration }
  } catch (err) {
    console.warn('[TTS] Failed to parse word boundary metadata:', err)
    return { timings: [], actualDuration: 0 }
  }
}

export class EdgeTTSProvider implements ITTSProvider {
  readonly name = 'Edge TTS'

  get isAvailable(): boolean {
    return true // No binary or API key needed
  }

  async synthesize(text: string, voice: VoiceProfile): Promise<TTSSynthesisResult> {
    const hash = computeSectionHash(text, voice.voiceId, 'edge-tts')
    const cached = getCachedResult(hash)
    if (cached) return cached

    // Each call needs a unique directory — msedge-tts writes to a fixed filename (audio.mp3)
    const outputDir = join(getVoiceoverDir(), `tts-${Date.now()}-${randomUUID().slice(0, 8)}`)
    mkdirSync(outputDir, { recursive: true })
    // Pre-create metadata.json — msedge-tts internally calls unlinkSync on it during
    // stream close cleanup, which crashes with ENOENT if the file doesn't exist
    writeFileSync(join(outputDir, 'metadata.json'), '{}', 'utf-8')

    let audioFilePath: string
    let metadataFilePath: string | null = null
    try {
      const tts = new MsEdgeTTS()
      await tts.setMetadata(voice.voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        wordBoundaryEnabled: true,
      })
      const fileResult = await tts.toFile(outputDir, text)
      audioFilePath = fileResult.audioFilePath
      metadataFilePath = fileResult.metadataFilePath ?? null

      // Read metadata BEFORE close — msedge-tts may unlink files on close
      const wordTimingsResult = parseWordTimings(metadataFilePath)

      tts.close()

      const fileSize = statSync(audioFilePath).size
      if (fileSize === 0) {
        throw new Error('Edge TTS returned empty audio file — synthesis produced no output')
      }
      console.log(`[TTS] Wrote ${fileSize} bytes to ${audioFilePath}`)

      // Use actual duration from word boundaries if available, otherwise estimate from word count
      const wordCount = text.split(/\s+/).length
      const estimatedDuration = (wordCount / 150) * 60 * 1000
      const duration = wordTimingsResult.actualDuration > 0 ? wordTimingsResult.actualDuration : estimatedDuration

      const result: TTSSynthesisResult = {
        filePath: audioFilePath,
        duration,
        sectionId: '',
        wordTimings: wordTimingsResult.timings,
      }
      setCachedResult(hash, result)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Edge TTS synthesis failed: ${message}`)
    }
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
