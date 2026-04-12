import { ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '@shared/constants'
import type { Clip } from '@shared/types/events'
import * as projectStore from '../services/project-store'
import { extractThumbnails } from '../utils/ffmpeg'
import { assertTrustedIPCEvent } from './security'

export function registerClipIPC(): void {
  ipcMain.handle(IPC_CHANNELS.CLIP_CREATE, async (event, clip: Clip) => {
    assertTrustedIPCEvent(event)
    return projectStore.createClip(clip)
  })

  ipcMain.handle(IPC_CHANNELS.CLIP_LIST, async (event, projectId?: string) => {
    assertTrustedIPCEvent(event)
    return projectStore.listClips(projectId)
  })

  ipcMain.handle(IPC_CHANNELS.CLIP_DELETE, async (event, id: string) => {
    assertTrustedIPCEvent(event)
    const clips = projectStore.listClips()
    const clip = clips.find((c) => c.id === id)
    if (clip) {
      // Delete associated scripts and their sections
      const db = projectStore.getDatabase()
      db.prepare('DELETE FROM script_sections WHERE script_id IN (SELECT id FROM scripts WHERE clip_id = ?)').run(id)
      db.prepare('DELETE FROM scripts WHERE clip_id = ?').run(id)
      // Delete recording directory (video, events, thumbnails)
      const dir = path.dirname(clip.filePath)
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
    return projectStore.deleteClip(id)
  })

  ipcMain.handle(IPC_CHANNELS.CLIP_EXPORT, async (event, id: string) => {
    assertTrustedIPCEvent(event)
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

  ipcMain.handle(IPC_CHANNELS.CLIP_GET_EVENTS, async (event, clipId: string) => {
    assertTrustedIPCEvent(event)
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

  ipcMain.handle(IPC_CHANNELS.CLIP_GET_THUMBNAILS, async (event, clipId: string, count: number) => {
    assertTrustedIPCEvent(event)
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
