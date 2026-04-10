import { v4 as uuid } from 'uuid'
import { tmpdir } from 'os'
import { join } from 'path'
import { readFileSync, unlinkSync } from 'fs'
import type { IAIProvider } from '@shared/interfaces/ai-provider'
import type { Script, ScriptGenContext } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { getSystemPrompt, buildScriptPrompt } from './prompt-templates'
import { parseScriptText } from './script-parser'
import { runCLI, isCLIAvailable } from './cli-runner'

export class OpenAIProvider implements IAIProvider {
  readonly name = 'OpenAI (Codex CLI)'
  private readonly model: string
  private readonly cliPath: string

  constructor(model = 'gpt-4o', cliPath = 'codex') {
    this.model = model
    this.cliPath = cliPath
  }

  get isAvailable(): boolean {
    return isCLIAvailable(this.cliPath)
  }

  async generateScript(prompt: string, context: ScriptGenContext): Promise<Script> {
    const scriptId = uuid()
    const userMessage = `${prompt}\n\n${buildScriptPrompt(context)}`
    const combinedPrompt = `SYSTEM INSTRUCTIONS:\n${getSystemPrompt()}\n\nUSER REQUEST:\n${userMessage}`

    const text = await this.runCodex(combinedPrompt)
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
    const sectionsText = script.sections
      .map((s, i) => `Section ${i + 1}: "${s.text.slice(0, 100)}..." (${s.startTime}ms - ${s.endTime}ms)`)
      .join('\n')

    const eventsText = domEvents
      .slice(0, 50)
      .map((e) => `[${(e.timestamp / 1000).toFixed(1)}s] ${e.type} on ${e.elementSelector}`)
      .join('\n')

    const combinedPrompt = `SYSTEM INSTRUCTIONS:\nYou are a video sync point analyzer. Return only valid JSON arrays.\n\nUSER REQUEST:\nGiven these script sections:\n${sectionsText}\n\nAnd these DOM events:\n${eventsText}\n\nReturn a JSON array of sync points. Each sync point should have: timestamp (ms), type ("freeze"|"zoom"|"annotation"|"transition"), duration (ms), confidence (0-1). Only return the JSON array, no other text.`

    try {
      const text = await this.runCodex(combinedPrompt)
      const jsonMatch = text.match(/\[[\s\S]*\]/)
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
      await this.runCodex('Reply OK', 30_000)
      return true
    } catch {
      return false
    }
  }

  private async runCodex(prompt: string, timeoutMs?: number): Promise<string> {
    const isWin = process.platform === 'win32'

    if (isWin) {
      // On Windows, -o /dev/stdout doesn't work. Use a temp file.
      const tempFile = join(tmpdir(), `leonardo-codex-${uuid()}.txt`)
      const args = [
        'exec',
        '--sandbox', 'read-only',
        '--skip-git-repo-check',
        '--ephemeral',
        '-m', this.model,
        '-o', tempFile,
      ]
      await runCLI(this.cliPath, args, prompt, timeoutMs)
      try {
        const output = readFileSync(tempFile, 'utf-8')
        return output.trim()
      } finally {
        try { unlinkSync(tempFile) } catch { /* ignore cleanup errors */ }
      }
    } else {
      const args = [
        'exec',
        '--sandbox', 'read-only',
        '--skip-git-repo-check',
        '--ephemeral',
        '-m', this.model,
        '-o', '/dev/stdout',
      ]
      const result = await runCLI(this.cliPath, args, prompt, timeoutMs)
      return result.stdout.trim()
    }
  }
}
