import type { Codec, ExportTargetType, Resolution, YouTubeMetadata } from './project'

export interface ExportTarget {
  type: ExportTargetType
  codec: Codec
  resolution: Resolution
  settings: ExportSettings
}

export interface ExportSettings {
  bitrate?: number
  fps?: number
  quality?: 'draft' | 'standard' | 'high'
  outputPath?: string
  youtubeMetadata?: YouTubeMetadata
}

export interface ExportResult {
  success: boolean
  outputPath?: string
  url?: string
  error?: string
  duration?: number
  fileSize?: number
}
