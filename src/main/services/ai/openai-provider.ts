import OpenAI from 'openai'
import type { IAIProvider } from '@shared/interfaces/ai-provider'
import type { Script, ScriptGenContext } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { v4 as uuidv4 } from 'uuid'
import { buildScriptPrompt, getSystemPrompt } from './prompt-templates'
import { parseScriptText } from './script-parser'

export class OpenAIProvider implements IAIProvider {
  readonly name = 'OpenAI'
  private client: OpenAI | null = null
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = 'gpt-4o') {
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

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt() },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 4096,
    })

    const text = response.choices[0]?.message?.content ?? ''
    const sections = parseScriptText(text, scriptId)

    return {
      id: scriptId,
      projectId: '',
      sections,
      aiBackendUsed: 'openai',
      prompt,
      generatedAt: new Date().toISOString(),
    }
  }

  async refineSyncPoints(script: Script, domEvents: DOMEvent[]): Promise<SyncPoint[]> {
    const client = this.getClient()

    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a video sync point analyzer. Given a script and DOM events, identify optimal sync points. Output JSON array.',
        },
        {
          role: 'user',
          content: `Script sections:\n${script.sections.map((s) => s.text).join('\n\n')}\n\nDOM events:\n${JSON.stringify(domEvents.slice(0, 50), null, 2)}\n\nReturn a JSON array of sync points.`,
        },
      ],
      max_tokens: 2048,
    })

    const text = response.choices[0]?.message?.content ?? ''

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // Parse error
    }
    return []
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 10,
      })
      return true
    } catch {
      return false
    }
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey })
    }
    return this.client
  }
}
