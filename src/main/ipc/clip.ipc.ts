import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '@shared/constants'
import type { Clip } from '@shared/types/events'
import * as projectStore from '../services/project-store'
import { extractThumbnails } from '../utils/ffmpeg'

export function registerClipIPC(): void {
  ipcMain.handle(IPC_CHANNELS.CLIP_CREATE, async (_event, clip: Clip) =>
    projectStore.createClip(clip),
  )

  ipcMain.handle(IPC_CHANNELS.CLIP_LIST, async (_event, projectId?: string) =>
    projectStore.listClips(projectId),
  )

  ipcMain.handle(IPC_CHANNELS.CLIP_DELETE, async (_event, id: string) =>
    projectStore.deleteClip(id),
  )

  ipcMain.handle(IPC_CHANNELS.CLIP_EXPORT, async (_event, id: string) => {
    try {
      const clips = await projectStore.listClips()
      const clip = clips.find((c) => c.id === id)
      if (!clip) {
        return { success: false, error: 'Clip not found' }
      }
      const { filePath: outputPath, canceled } = await dialog.showSaveDialog({
        defaultPath: path.basename(clip.filePath),
      })
      if (canceled || !outputPath) {
        return { success: false, error: 'Cancelled' }
      }
      await fs.promises.copyFile(clip.filePath, outputPath)
      return { success: true, outputPath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLIP_GET_EVENTS, async (_event, clipId: string) => {
    const clips = await projectStore.listClips()
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return []
    const basename = path.basename(clip.filePath, path.extname(clip.filePath))
    const eventsPath = path.join(path.dirname(clip.filePath), `${basename}.events.json`)
    try {
      const json = await fs.promises.readFile(eventsPath, 'utf-8')
      return JSON.parse(json)
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC_CHANNELS.CLIP_GET_THUMBNAILS, async (_event, clipId: string, count: number) => {
    const clips = await projectStore.listClips()
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return []
    try {
      return await extractThumbnails(clip.filePath, path.dirname(clip.filePath), count, clip.duration)
    } catch {
      return []
    }
  })
}
