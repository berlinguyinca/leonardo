export type SyncPointType = 'freeze' | 'zoom' | 'annotation' | 'transition'
export type SyncPointSource = 'dom' | 'script' | 'manual'
export type TrackType = 'recording' | 'clip' | 'overlay' | 'audio'
export type TransitionType = 'fade' | 'cut' | 'dissolve' | 'wipe'

export interface SyncTimeline {
  id: string
  projectId: string
  tracks: Track[]
  syncPoints: SyncPoint[]
  duration: number
  reviewed: boolean
}

export interface Track {
  id: string
  type: TrackType
  segments: Segment[]
  zOrder: number
  label: string
  muted: boolean
  locked: boolean
}

export interface Segment {
  id: string
  trackId: string
  startTime: number
  endTime: number
  sourceFile: string
  sourceOffset: number
  label: string
  metadata?: string
}

export interface SyncPoint {
  id: string
  timelineId: string
  timestamp: number
  type: SyncPointType
  source: SyncPointSource
  duration: number
  coordinates?: { x: number; y: number; width: number; height: number }
  annotationText?: string
  transitionType?: TransitionType
  confidence: number
}
