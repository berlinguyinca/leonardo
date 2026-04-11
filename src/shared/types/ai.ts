import type { DOMEvent } from './events'

export type AIProviderType = 'claude' | 'openai' | 'ollama'
export type AIMode = 'cloud' | 'local'

export interface AIBackendConfig {
  provider: AIProviderType
  mode: AIMode
  model?: string
  ollamaBaseUrl?: string
  cliPath?: string
}

export interface ScriptGenContext {
  domEvents: DOMEvent[]
  recordingDuration: number
  url: string
  userPrompt: string
}

export interface Script {
  id: string
  projectId: string
  clipId?: string
  sections: ScriptSection[]
  aiBackendUsed: AIProviderType
  prompt: string
  generatedAt: string
}

export interface ScriptSection {
  id: string
  scriptId: string
  text: string
  voiceProfileId: string | null
  startTime: number
  endTime: number
  timingMarkers: TimingMarker[]
  order: number
}

export type TimingMarkerType = 'pause' | 'zoom' | 'freeze' | 'transition'

export interface TimingMarker {
  type: TimingMarkerType
  position: number
  duration?: number
  selector?: string
  transitionType?: string
}
