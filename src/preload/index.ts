import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types/project'
import type { ArchiveImportResult } from '../main/services/archive'

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
}

export type LeonardoAPI = typeof api

contextBridge.exposeInMainWorld('leonardo', api)
