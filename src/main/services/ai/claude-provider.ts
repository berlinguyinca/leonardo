import { v4 as uuid } from 'uuid'
import type { IAIProvider } from '@shared/interfaces/ai-provider'
import type { Script, ScriptGenContext } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { getSystemPrompt, buildScriptPrompt } from './prompt-templates'
import { parseScriptText } from './script-parser'
import { runCLI, isCLIAvailable } from './cli-runner'

export class ClaudeProvider implements IAIProvider {
  readonly name = 'Claude (CLI)'
  private readonly model: string
  private readonly cliPath: string

  constructor(model = 'claude-sonnet-4-20250514', cliPath = 'claude') {
    this.model = model
    this.cliPath = cliPath
  }

  get isAvailable(): boolean {
    return isCLIAvailable(this.cliPath)
  }

  async generateScript(prompt: string, context: ScriptGenContext): Promise<Script> {
    const scriptId = uuid()
    const userMessage = `${prompt}\n\n${buildScriptPrompt(context)}`

    const args = [
      '-p',
      '--system-prompt', getSystemPrompt(),
      '--output-format', 'text',
      '--model', this.model,
      '--no-session-persistence',
      '--tools', '',
      '--bare',
    ]

    const result = await runCLI(this.cliPath, args, userMessage)
    const text = result.stdout.trim()
    const sections = parseScriptText(text, scriptId)

    return {
      id: scriptId,
      projectId: '',
      sections,
      aiBackendUsed: 'claude',
      prompt,
      generatedAt: new Date().toISOString(),
    }
  }

  async refineSyncPoints(script: Script, domEvents: DOMEvent[]): Promise<SyncPoint[]> {
    const sectionsText = script.sections
      .map((s, i) => `Section ${i + 1}: "${s.text.slice(0, 100)}..." (${s.startTime}ms - ${s.endTime}ms)`)
      .join('\n')

    const eventsText = domEvents
      .slice(0, 50)
      .map((e) => `[${(e.timestamp / 1000).toFixed(1)}s] ${e.type} on ${e.elementSelector}`)
      .join('\n')

    const userMessage = `Given these script sections:\n${sectionsText}\n\nAnd these DOM events:\n${eventsText}\n\nReturn a JSON array of sync points. Each sync point should have: timestamp (ms), type ("freeze"|"zoom"|"annotation"|"transition"), duration (ms), confidence (0-1). Only return the JSON array, no other text.`

    const systemPrompt = 'You are a video sync point analyzer. Return only valid JSON arrays.'

    const args = [
      '-p',
      '--system-prompt', systemPrompt,
      '--output-format', 'text',
      '--model', this.model,
      '--no-session-persistence',
      '--tools', '',
      '--bare',
    ]

    try {
      const result = await runCLI(this.cliPath, args, userMessage)
      const jsonMatch = result.stdout.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []

      const raw = JSON.parse(jsonMatch[0]) as Array<{
        timestamp: number
        type: string
        duration: number
        confidence: number
      }>

      return raw.map((item) => ({
        id: uuid(),
        timelineId: '',
        timestamp: item.timestamp,
        type: item.type as SyncPoint['type'],
        source: 'script' as const,
        duration: item.duration ?? 0,
        confidence: item.confidence ?? 0.5,
      }))
    } catch {
      return []
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const args = ['-p', '--bare', '--tools', '', '--no-session-persistence', 'ping']
      const result = await runCLI(this.cliPath, args, undefined, 30_000)
      return result.stdout.length > 0
    } catch {
      return false
    }
  }
}
