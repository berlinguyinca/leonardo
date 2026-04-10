import type { Recording, DOMEvent } from '../types/events'
import type { Script } from '../types/ai'

export interface IInputMode {
  readonly type: string

  start(): Promise<void>
  stop(): Promise<void>
  getRecording(): Recording
  getScript(): Script | null
  getDOMEvents(): DOMEvent[]
}
