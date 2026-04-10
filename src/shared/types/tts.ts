export type TTSEngineType = 'piper' | 'coqui' | 'elevenlabs'
export type TTSQualityTier = 'free' | 'production'

export interface TTSConfig {
  engine: TTSEngineType
  qualityTier: TTSQualityTier
  defaultVoiceId: string | null
}

export interface VoiceProfile {
  id: string
  name: string
  provider: TTSEngineType
  voiceId: string
  samples: string[]
  isDefault: boolean
}

export interface TTSSynthesisResult {
  filePath: string
  duration: number
  sectionId: string
}
