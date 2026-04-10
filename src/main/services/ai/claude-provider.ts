import Anthropic from '@anthropic-ai/sdk'
import type { IAIProvider } from '@shared/interfaces/ai-provider'
import type { Script, ScriptGenContext } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { v4 as uuidv4 } from 'uuid'
import { buildScriptPrompt, getSystemPrompt } from './prompt-templates'
import { parseScriptText } from './script-parser'

export class ClaudeProvider implements IAIProvider {
  readonly name = 'Claude'
  private client: Anthropic | null = null
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
    this.apiKey = apiKey
    this.model = model
  }

  get isAvailable(): boolean {
    return this.apiKey.length > 0
  }

  async generateScript(prompt: string, context: ScriptGenContext): Promise<Script> {
    const client = this.getClient()
    const scriptId = uuidv4()
    const userMessage = buildScriptPrompt(context)

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: getSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

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
    const client = this.getClient()

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: 'You are a video sync point analyzer. Given a script and DOM events, identify optimal sync points for freeze frames, zoom-ins, and transitions. Output JSON array.',
      messages: [
        {
          role: 'user',
          content: `Script sections:\n${script.sections.map((s) => s.text).join('\n\n')}\n\nDOM events:\n${JSON.stringify(domEvents.slice(0, 50), null, 2)}\n\nReturn a JSON array of sync points with: timestamp, type (freeze/zoom/annotation/transition), duration, confidence (0-1).`,
        },
      ],
    })

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // Failed to parse — return empty
    }
    return []
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch {
      return false
    }
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.apiKey })
    }
    return this.client
  }
}
