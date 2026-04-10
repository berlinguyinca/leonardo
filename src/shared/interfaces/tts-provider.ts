import type { VoiceProfile, TTSSynthesisResult } from '../types/tts'

export interface ITTSProvider {
  readonly name: string
  readonly isAvailable: boolean

  synthesize(text: string, voice: VoiceProfile): Promise<TTSSynthesisResult>
  getVoices(): Promise<VoiceProfile[]>
  testConnection(): Promise<boolean>
}
