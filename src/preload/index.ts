import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types/project'
import type { ArchiveImportResult } from '../main/services/archive'
import type { Clip, DOMEvent } from '@shared/types/events'
import type { AIBackendConfig, Script, ScriptGenContext, ScriptSection } from '@shared/types/ai'
import type { SyncTimeline } from '@shared/types'
import type { TTSEngineType, VoiceProfile, TTSSynthesisResult } from '@shared/types/tts'

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
      warning?: string
      error?: string
    }> => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_START, args),
    stop: (): Promise<{
      success: boolean
      recordingId?: string
      videoPath?: string
      outputDir?: string
      domEvents?: unknown[]
      duration?: number
      error?: string
    }> => ipcRenderer.invoke(IPC_CHANNELS.RECORDING_STOP),
    pause: (): Promise<{ success: boolean }> => ipcRenderer.invoke('recording:pause'),
    resume: (): Promise<{ success: boolean }> => ipcRenderer.invoke('recording:resume'),
    getStatus: (): Promise<{
      isRecording: boolean
      recordingId: string | null
      status: string
      duration: number
    }> => ipcRenderer.invoke(IPC_CHANNELS.WORKER_STATUS),
    relayDomEvent: (data: unknown): void => ipcRenderer.send('dom-event-relay', data),
    getWebviewPreloadPath: (): Promise<string> =>
      ipcRenderer.invoke('recording:get-webview-preload-path'),
  },
  clip: {
    create: (clip: Clip): Promise<Clip> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_CREATE, clip),
    list: (projectId?: string): Promise<Clip[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_LIST, projectId),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_DELETE, id),
    export: (id: string): Promise<{ success: boolean; outputPath?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_EXPORT, id),
    getEvents: (id: string): Promise<DOMEvent[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_GET_EVENTS, id),
    getThumbnails: (id: string, count: number): Promise<string[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIP_GET_THUMBNAILS, id, count),
  },
  ai: {
    generateScript: (args: {
      config: AIBackendConfig
      prompt: string
      context: ScriptGenContext
      projectId: string
      clipId?: string
    }): Promise<{ success: boolean; script?: Script; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_SCRIPT, args),
    generateScriptStream: (args: {
      config: AIBackendConfig
      prompt: string
      context: ScriptGenContext
      projectId: string
      clipId?: string
    }): Promise<{ success: boolean; script?: Script; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_SCRIPT_STREAM, args),
    onStreamChunk: (cb: (chunk: string) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_CHUNK, (_e, chunk) => cb(chunk))
    },
    onStreamDone: (cb: (script: unknown) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_DONE, (_e, script) => cb(script))
    },
    onStreamError: (cb: (err: unknown) => void): void => {
      ipcRenderer.on(IPC_CHANNELS.AI_STREAM_ERROR, (_e, err) => cb(err))
    },
    removeStreamListeners: (): void => {
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_CHUNK)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_DONE)
      ipcRenderer.removeAllListeners(IPC_CHANNELS.AI_STREAM_ERROR)
    },
  },
  log: {
    read: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.LOG_READ),
    clear: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.LOG_CLEAR),
  },
  script: {
    save: (script: Script, clipId?: string): Promise<Script> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_SAVE, script, clipId),
    listByProject: (projectId: string): Promise<Array<Script & { sections: ScriptSection[] }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_LIST_BY_PROJECT, projectId),
    delete: (clipId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SCRIPT_DELETE, { clipId }),
  },
  settings: {
    get: (key: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, { key, value }),
  },
  timeline: {
    save: (timeline: SyncTimeline): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.TIMELINE_SAVE, timeline),
    get: (projectId: string): Promise<SyncTimeline | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.TIMELINE_GET, projectId),
    delete: (projectId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.TIMELINE_DELETE, projectId),
  },
  tts: {
    synthesize: (args: { text: string; voice: VoiceProfile; engine: TTSEngineType }): Promise<TTSSynthesisResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.TTS_SYNTHESIZE, args),
    listVoices: (engine: TTSEngineType): Promise<VoiceProfile[]> =>
      ipcRenderer.invoke('tts:list-voices', engine),
    testConnection: (engine: TTSEngineType): Promise<boolean> =>
      ipcRenderer.invoke('tts:test-connection', engine),
  },
}

export type LeonardoAPI = typeof api

contextBridge.exposeInMainWorld('leonardo', api)
