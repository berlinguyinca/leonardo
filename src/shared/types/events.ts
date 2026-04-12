export type DOMEventType = 'click' | 'submit' | 'navigate' | 'focus' | 'input' | 'scroll'

export interface DOMEvent {
  id: string
  type: DOMEventType
  timestamp: number
  elementSelector: string
  coordinates: { x: number; y: number }
  elementText?: string
  url?: string
  value?: string
  // Semantic metadata fields for AI script generation
  tagName?: string
  alt?: string
  title?: string
  ariaLabel?: string
  ariaDescribedby?: string
  href?: string
  elementType?: string
  role?: string
  name?: string
  placeholder?: string
}

export interface Recording {
  id: string
  projectId: string
  videoFile: string
  domEvents: DOMEvent[]
  duration: number
  url: string
  resolution: { width: number; height: number }
  createdAt: string
}

export interface Clip {
  id: string
  projectId: string
  filePath: string
  duration: number
  url: string
  resolution: { width: number; height: number }
  createdAt: string
  label: string
}

export type StoryboardStepType = 'intro' | 'step' | 'outro'

export interface StoryboardStep {
  id: string
  type: StoryboardStepType
  segmentId: string | null
  eventIds: string[]
  transitionType: import('./timeline').TransitionType
  scriptPlaceholder: string
  order: number
}
