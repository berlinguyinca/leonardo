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
