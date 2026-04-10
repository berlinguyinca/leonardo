import { ipcMain, safeStorage } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AIBackendConfig, ScriptGenContext, Script } from '@shared/types/ai'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { createAIProvider } from '../services/ai'
import { getDatabase } from '../services/project-store'

export function registerAIIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.AI_GENERATE_SCRIPT,
    async (
      _event,
      args: {
        config: AIBackendConfig
        prompt: string
        context: ScriptGenContext
        projectId: string
      },
    ): Promise<{ success: boolean; script?: Script; error?: string }> => {
      try {
        const provider = createAIProvider(args.config)
        const script = await provider.generateScript(args.prompt, args.context)
        script.projectId = args.projectId

        return { success: true, script }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        return { success: false, error: errorMessage }
      }
    },
  )

  ipcMain.handle(
    'ai:refine-sync-points',
    async (
      _event,
      args: {
        config: AIBackendConfig
        script: Script
        domEvents: DOMEvent[]
      },
    ): Promise<{ success: boolean; syncPoints?: SyncPoint[]; error?: string }> => {
      try {
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
    async (_event, config: AIBackendConfig): Promise<boolean> => {
      try {
        const provider = createAIProvider(config)
        return await provider.testConnection()
      } catch {
        return false
      }
    },
  )

  ipcMain.handle(
    'ai:list-ollama-models',
    async (_event, baseUrl?: string): Promise<string[]> => {
      const { OllamaProvider } = await import('../services/ai/ollama-provider')
      const provider = new OllamaProvider('', baseUrl)
      return provider.listModels()
    },
  )

  // Secure API key storage
  ipcMain.handle(
    'ai:store-api-key',
    async (_event, args: { provider: string; apiKey: string }): Promise<boolean> => {
      try {
        const db = getDatabase()
        const encrypted = safeStorage.encryptString(args.apiKey).toString('base64')
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
          .run(`apikey_${args.provider}`, encrypted)
        return true
      } catch {
        return false
      }
    },
  )

  ipcMain.handle(
    'ai:get-api-key',
    async (_event, provider: string): Promise<string> => {
      try {
        const db = getDatabase()
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`apikey_${provider}`) as { value: string } | undefined
        if (!row) return ''
        const decrypted = safeStorage.decryptString(Buffer.from(row.value, 'base64'))
        return decrypted
      } catch {
        return ''
      }
    },
  )
}
