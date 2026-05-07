import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AIBackendConfig, ScriptGenContext, Script, ScriptSection, GenerationLog } from '@shared/types/ai'
import { getSystemPrompt, buildScriptPrompt } from '../services/ai/prompt-templates'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { createAIProvider } from '../services/ai'
import { saveScript, listScriptsByProject, deleteScriptsForClip } from '../services/project-store'
import { assertTrustedIPCEvent } from './security'

export function registerAIIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.AI_GENERATE_SCRIPT,
    async (
      event,
      args: {
        config: AIBackendConfig
        prompt: string
        context: ScriptGenContext
        projectId: string
        clipId?: string
      },
    ): Promise<{ success: boolean; script?: Script; generationLog?: GenerationLog; error?: string }> => {
      try {
        assertTrustedIPCEvent(event)
        console.log(`[AI] Generating script: provider=${args.config.provider} model=${args.config.model ?? 'default'} prompt="${args.prompt.slice(0, 100)}..."`)
        const provider = createAIProvider(args.config)
        const systemPrompt = getSystemPrompt()
        const userMessage = `${args.prompt}\n\n${buildScriptPrompt(args.context)}`
        const script = await provider.generateScript(args.prompt, args.context)
        script.projectId = args.projectId
        const saved = saveScript(script, args.clipId)
        const generationLog: GenerationLog = {
          systemPrompt,
          userMessage,
          rawResponse: saved.sections.map((s, i) => `${i + 1}. ${s.text}`).join('\n\n'),
          timestamp: new Date().toISOString(),
          provider: args.config.provider,
        }
        console.log(`[AI] Script generated: ${saved.sections.length} sections`)
        return { success: true, script: saved, generationLog }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error(`[AI] Script generation failed: ${errorMessage}`)
        if (err instanceof Error && err.stack) {
          console.error(`[AI] Stack: ${err.stack}`)
        }
        return { success: false, error: errorMessage }
      }
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.AI_GENERATE_SCRIPT_STREAM,
    async (
      event,
      args: {
        config: AIBackendConfig
        prompt: string
        context: ScriptGenContext
        projectId: string
        clipId?: string
      },
    ): Promise<{ success: boolean; script?: Script; error?: string }> => {
      try {
        assertTrustedIPCEvent(event)
        console.log(`[AI:stream] Generating script: provider=${args.config.provider} model=${args.config.model ?? 'default'} prompt="${args.prompt.slice(0, 100)}..."`)
        const provider = createAIProvider(args.config)

        if (!provider.generateScriptStream) {
          // Fall back to non-streaming
          const script = await provider.generateScript(args.prompt, args.context)
          script.projectId = args.projectId
          const saved = saveScript(script, args.clipId)
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC_CHANNELS.AI_STREAM_DONE, saved)
          }
          return { success: true, script: saved }
        }

        const script = await provider.generateScriptStream(
          args.prompt,
          args.context,
          (chunk: string) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, chunk)
            }
          },
        )

        script.projectId = args.projectId
        const saved = saveScript(script, args.clipId)
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.AI_STREAM_DONE, saved)
        }
        return { success: true, script: saved }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        console.error(`[AI:stream] Script generation failed: ${error}`)
        if (err instanceof Error && err.stack) {
          console.error(`[AI:stream] Stack: ${err.stack}`)
        }
        const detail = {
          error,
          provider: args.config.provider,
          model: args.config.model ?? 'default',
          promptPreview: args.prompt.slice(0, 200),
          fullPrompt: args.prompt,
          stack: err instanceof Error ? err.stack : undefined,
          timestamp: Date.now(),
        }
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.AI_STREAM_ERROR, detail)
        }
        return { success: false, error }
      }
    },
  )

  ipcMain.handle(
    'ai:refine-sync-points',
    async (
      event,
      args: {
        config: AIBackendConfig
        script: Script
        domEvents: DOMEvent[]
      },
    ): Promise<{ success: boolean; syncPoints?: SyncPoint[]; error?: string }> => {
      try {
        assertTrustedIPCEvent(event)
        console.log(`[AI] Refining sync points: provider=${args.config.provider} sections=${args.script.sections.length} events=${args.domEvents.length}`)
        const provider = createAIProvider(args.config)
        const syncPoints = await provider.refineSyncPoints(args.script, args.domEvents)
        console.log(`[AI] Sync points refined: ${syncPoints.length} points`)
        return { success: true, syncPoints }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error(`[AI] Sync point refinement failed: ${errorMessage}`)
        return { success: false, error: errorMessage }
      }
    },
  )

  ipcMain.handle(
    'ai:test-connection',
    async (event, config: AIBackendConfig): Promise<boolean> => {
      try {
        assertTrustedIPCEvent(event)
        const provider = createAIProvider(config)
        return await provider.testConnection()
      } catch {
        return false
      }
    },
  )

  ipcMain.handle(
    'ai:list-ollama-models',
    async (event, baseUrl?: string): Promise<string[]> => {
      assertTrustedIPCEvent(event)
      const { OllamaProvider } = await import('../services/ai/ollama-provider')
      const provider = new OllamaProvider('', baseUrl)
      return provider.listModels()
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.SCRIPT_SAVE,
    async (event, script: Script, clipId?: string): Promise<Script> => {
      assertTrustedIPCEvent(event)
      return saveScript(script, clipId)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.SCRIPT_LIST_BY_PROJECT,
    async (event, projectId: string): Promise<Array<Script & { sections: ScriptSection[] }>> => {
      assertTrustedIPCEvent(event)
      return listScriptsByProject(projectId)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.SCRIPT_DELETE,
    async (event, args: { clipId: string }): Promise<{ success: boolean }> => {
      assertTrustedIPCEvent(event)
      deleteScriptsForClip(args.clipId)
      return { success: true }
    },
  )

}
