import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Clip } from '@shared/types/events'
import * as projectStore from '../services/project-store'

export function registerClipIPC(): void {
  ipcMain.handle(IPC_CHANNELS.CLIP_CREATE, async (_event, clip: Clip) =>
    projectStore.createClip(clip),
  )

  ipcMain.handle(IPC_CHANNELS.CLIP_LIST, async () =>
    projectStore.listClips(),
  )

  ipcMain.handle(IPC_CHANNELS.CLIP_DELETE, async (_event, id: string) =>
    projectStore.deleteClip(id),
  )
}
