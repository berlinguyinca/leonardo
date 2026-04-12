import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AIBackendConfig, ScriptGenContext, Script, ScriptSection } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { createAIProvider } from '../services/ai'
import { saveScript, listScriptsByProject } from '../services/project-store'
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
    ): Promise<{ success: boolean; script?: Script; error?: string }> => {
      try {
        assertTrustedIPCEvent(event)
        const provider = createAIProvider(args.config)
        const script = await provider.generateScript(args.prompt, args.context)
        script.projectId = args.projectId
        const saved = saveScript(script, args.clipId)
        return { success: true, script: saved }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
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
        const provider = createAIProvider(args.config)
        const syncPoints = await provider.refineSyncPoints(args.script, args.domEvents)
        return { success: true, syncPoints }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
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

}
