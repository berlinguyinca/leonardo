import type { IAIProvider } from '@shared/interfaces/ai-provider'
import type { Script, ScriptGenContext } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { v4 as uuidv4 } from 'uuid'
import { buildScriptPrompt, getSystemPrompt } from './prompt-templates'
import { parseScriptText } from './script-parser'

export class OllamaProvider implements IAIProvider {
  readonly name = 'Ollama'
  private baseUrl: string
  private model: string

  constructor(model = 'llama3', baseUrl = 'http://localhost:11434') {
    this.model = model
    this.baseUrl = baseUrl
  }

  get isAvailable(): boolean {
    // Ollama is always "available" — actual availability checked via testConnection
    return true
  }

  async generateScript(prompt: string, context: ScriptGenContext): Promise<Script> {
    const scriptId = uuidv4()
    const userMessage = `${prompt}\n\n${buildScriptPrompt(context)}`

    const response = await this.chat([
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: userMessage },
    ])

    const sections = parseScriptText(response, scriptId)

    return {
      id: scriptId,
      projectId: '',
      sections,
      aiBackendUsed: 'ollama',
      prompt,
      generatedAt: new Date().toISOString(),
    }
  }

  async generateScriptStream(
    prompt: string,
    context: ScriptGenContext,
    onChunk: (chunk: string) => void,
  ): Promise<Script> {
    const scriptId = uuidv4()
    const userMessage = `${prompt}\n\n${buildScriptPrompt(context)}`

    const streamController = new AbortController()
    const streamTimer = setTimeout(() => streamController.abort(), 120_000)
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: getSystemPrompt() },
            { role: 'user', content: userMessage },
          ],
          stream: true,
        }),
        signal: streamController.signal,
      })
    } finally {
      clearTimeout(streamTimer)
    }

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    let fullText = ''
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Ollama response body is not readable')
    }

    const decoder = new TextDecoder()
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) {
        const chunk = decoder.decode(result.value, { stream: true })
        // Ollama streams NDJSON — one JSON object per line
        const lines = chunk.split('\n').filter((line) => line.trim().length > 0)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
            const content = parsed.message?.content ?? ''
            if (content) {
              fullText += content
              onChunk(content)
            }
          } catch {
            // Skip malformed NDJSON lines
          }
        }
      }
    }

    const sections = parseScriptText(fullText, scriptId)

    return {
      id: scriptId,
      projectId: '',
      sections,
      aiBackendUsed: 'ollama',
      prompt,
      generatedAt: new Date().toISOString(),
    }
  }

  async refineSyncPoints(script: Script, domEvents: DOMEvent[]): Promise<SyncPoint[]> {
    try {
      const response = await this.chat([
        {
          role: 'system',
          content: 'You are a video sync point analyzer. Output JSON array of sync points.',
        },
        {
          role: 'user',
          content: `Script:\n${script.sections.map((s) => s.text).join('\n\n')}\n\nDOM events:\n${JSON.stringify(domEvents.slice(0, 50), null, 2)}\n\nReturn a JSON array of sync points.`,
        },
      ])

      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const raw = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>
        return raw.map((item) => ({
          id: crypto.randomUUID(),
          timelineId: '',
          timestamp: Number(item.timestamp) || 0,
          type: ['freeze', 'zoom', 'annotation', 'transition'].includes(String(item.type))
            ? (String(item.type) as SyncPoint['type'])
            : 'annotation',
          source: 'script' as const,
          duration: Number(item.duration) || 0,
          confidence: Number(item.confidence) || 0.5,
        }))
      }
    } catch (err) {
      console.error('refineSyncPoints failed:', err)
    }
    return []
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) return []
      const data = (await response.json()) as { models?: { name: string }[] }
      return data.models?.map((m) => m.name) ?? []
    } catch {
      return []
    }
  }

  private async chat(messages: { role: string; content: string }[]): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 120_000)
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as { message?: { content?: string } }
    return data.message?.content ?? ''
  }
}
