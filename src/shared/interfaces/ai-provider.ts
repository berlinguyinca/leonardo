import type { Script, ScriptGenContext } from '../types/ai'
import type { DOMEvent } from '../types/events'
import type { SyncPoint } from '../types/timeline'

export interface IAIProvider {
  readonly name: string
  readonly isAvailable: boolean

  generateScript(prompt: string, context: ScriptGenContext): Promise<Script>
  refineSyncPoints(script: Script, domEvents: DOMEvent[]): Promise<SyncPoint[]>
  testConnection(): Promise<boolean>
}
