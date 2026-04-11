import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types/project'
import type { ArchiveImportResult } from '../main/services/archive'
import type { Clip } from '@shared/types/events'
import type { AIBackendConfig, Script, ScriptGenContext } from '@shared/types/ai'

const api = {
  project: {
    create: (args: { name: string; inputMode: InputModeType; resolution: Resolution }): Promise<Project> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, args),
    get: (id: string): Promise<Project | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, id),
    list: (): Promise<Project[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    update: (id: string, updates: Partial<Project>): Promise<Project | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, { id, updates }),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, id),
  },
  archive: {
    export: (args: {
      projectId: string
      mediaFiles: string[]
      thumbnailFiles: string[]
      settings: Record<string, unknown>
    }): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.ARCHIVE_EXPORT, args),
    import: (): Promise<ArchiveImportResult | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.ARCHIVE_IMPORT),
  },
  recording: {
    start: (args: { webviewId: number; projectId?: string }): Promise<{
      success: boolean
      recordingId?: string
      outputDir?: string
      error?: string
    }> => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_START, args),
    stop: (): Promise<{
      success: boolean
      recordingId?: string
      outputDir?: string
      domEvents?: unknown[]
      duration?: number
      error?: string
    }> => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_STOP),
    pause: (): Promise<{ success: boolean }> => ipcRenderer.invoke('recording:pause'),
    resume: (): Promise<{ success: boolean }> => ipcRenderer.invoke('recording:resume'),
    convert: (args: {
      recordingId: string
      webmPath: string
      outputDir: string
      projectId: string
    }): Promise<{ success: boolean; videoPath?: string; eventsPath?: string; error?: string }> =>
      ipcRenderer.invoke('recording:convert', args),
    onProgress: (callback: (progress: { recordingId: string; stage: string; percent: number }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: { recordingId: string; stage: string; percent: number }) => callback(progress)
      ipcRenderer.on(IPC_CHANNELS.RENDER_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.RENDER_PROGRESS, handler)
    },
    getStatus: (): Promise<{
      isRecording: boolean
      recordingId: string | null
      status: string
      duration: number
    }> => ipcRenderer.invoke(IPC_CHANNELS.WORKER_STATUS),
  },
  clip: {
    create: (clip: Clip): Promise<Clip> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_CREATE, clip),
    list: (): Promise<Clip[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_LIST),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_DELETE, id),
    export: (id: string): Promise<{ success: boolean; outputPath?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_EXPORT, id),
  },
  ai: {
    generateScript: (args: {
      config: AIBackendConfig
      prompt: string
      context: ScriptGenContext
      projectId: string
    }): Promise<{ success: boolean; script?: Script; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_SCRIPT, args),
  },
  log: {
    read: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.LOG_READ),
  },
}

export type LeonardoAPI = typeof api

contextBridge.exposeInMainWorld('leonardo', api)
