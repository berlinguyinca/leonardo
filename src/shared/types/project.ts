export type InputModeType = 'record-first' | 'prompt-first' | 'simultaneous' | 'fully-automatic'
export type ProjectStatus = 'draft' | 'recording' | 'scripting' | 'syncing' | 'editing' | 'rendering' | 'exported'

export interface Project {
  id: string
  name: string
  inputMode: InputModeType
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  recordingResolution: Resolution
  exportConfig: ExportConfig | null
}

export interface Resolution {
  width: number
  height: number
  label: string // '1080p', '1440p', '4K'
}

export interface ExportConfig {
  codec: Codec
  resolution: Resolution
  targetType: ExportTargetType
  youtubeMetadata?: YouTubeMetadata
}

export type Codec = 'h264' | 'h265' | 'prores'
export type ExportTargetType = 'file' | 'youtube' | 'davinci'

export interface YouTubeMetadata {
  title: string
  description: string
  tags: string[]
  privacy: 'public' | 'unlisted' | 'private'
  categoryId: string
}

export const RESOLUTION_PRESETS: Record<string, Resolution> = {
  '1080p': { width: 1920, height: 1080, label: '1080p' },
  '1440p': { width: 2560, height: 1440, label: '1440p' },
  '4K': { width: 3840, height: 2160, label: '4K' },
}
