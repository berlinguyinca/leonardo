import { writeFileSync } from 'fs'
import { join } from 'path'
import type { ITTSProvider } from '@shared/interfaces/tts-provider'
import type { VoiceProfile, TTSSynthesisResult } from '@shared/types/tts'

export class ElevenLabsProvider implements ITTSProvider {
  readonly name = 'ElevenLabs'
  private apiKey: string
  private baseUrl = 'https://api.elevenlabs.io/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  get isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  async synthesize(text: string, voice: VoiceProfile): Promise<TTSSynthesisResult> {
    const outputPath = join(
      require('os').tmpdir(),
      `leonardo-tts-${Date.now()}-${voice.voiceId}.mp3`,
    )

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voice.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    writeFileSync(outputPath, buffer)

    // Estimate duration from text
    const wordCount = text.split(/\s+/).length
    const estimatedDuration = (wordCount / 150) * 60 * 1000

    return {
      filePath: outputPath,
      duration: estimatedDuration,
      sectionId: '',
    }
  }

  async getVoices(): Promise<VoiceProfile[]> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    })

    if (!response.ok) return []

    const data = (await response.json()) as {
      voices?: { voice_id: string; name: string; labels?: Record<string, string> }[]
    }

    return (data.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      provider: 'elevenlabs' as const,
      voiceId: v.voice_id,
      samples: [],
      isDefault: false,
    }))
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: { 'xi-api-key': this.apiKey },
      })
      return response.ok
    } catch {
      return false
    }
  }
}
