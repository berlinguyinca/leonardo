import { dialog, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS } from '@shared/constants'
import type { Clip } from '@shared/types/events'
import * as projectStore from '../services/project-store'
import { extractThumbnails } from '../utils/ffmpeg'
import { assertTrustedIPCEvent } from './security'
import { safeHandle } from './safe-handle'

export function registerClipIPC(): void {
  safeHandle(IPC_CHANNELS.CLIP_CREATE, async (event, clip: unknown) => {
    assertTrustedIPCEvent(event)
    return projectStore.createClip(clip as Clip)
  })

  safeHandle(IPC_CHANNELS.CLIP_LIST, async (event, projectId?: unknown) => {
    assertTrustedIPCEvent(event)
    return projectStore.listClips(projectId as string | undefined)
  })

  safeHandle(IPC_CHANNELS.CLIP_DELETE, async (event, id: unknown) => {
    assertTrustedIPCEvent(event)
    const clips = projectStore.listClips()
    const clip = clips.find((c) => c.id === id)
    if (clip) {
      // Wrap all DB operations in a transaction so partial failures don't corrupt data
      const db = projectStore.getDatabase()
      db.transaction(() => {
        db.prepare('DELETE FROM script_sections WHERE script_id IN (SELECT id FROM scripts WHERE clip_id = ?)').run(id as string)
        db.prepare('DELETE FROM scripts WHERE clip_id = ?').run(id as string)
        projectStore.deleteClip(id as string)
      })()
      // Only delete filesystem files after the DB transaction commits successfully.
      // Validate that the directory is under the recordings root before recursive delete.
      const dir = path.dirname(clip.filePath)
      const recordingsRoot = path.join(app.getPath('userData'), 'recordings')
      if (path.normalize(dir).startsWith(recordingsRoot)) {
        await fs.promises.rm(dir, { recursive: true, force: true }).catch((err: Error) => {
          console.warn(`[clip:delete] Failed to remove directory ${dir}:`, err.message)
        })
      } else {
        console.warn(`[clip:delete] Skipping directory removal — not under recordings root: ${dir}`)
      }
      return true
    }
    return projectStore.deleteClip(id as string)
  })

  safeHandle(IPC_CHANNELS.CLIP_EXPORT, async (event, id: unknown) => {
    assertTrustedIPCEvent(event)
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
  })

  safeHandle(IPC_CHANNELS.CLIP_GET_EVENTS, async (event, clipId: unknown) => {
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

  safeHandle(IPC_CHANNELS.CLIP_GET_THUMBNAILS, async (event, clipId: unknown, count: unknown) => {
    assertTrustedIPCEvent(event)
    const clips = await projectStore.listClips()
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return []
    try {
      return await extractThumbnails(clip.filePath, path.dirname(clip.filePath), count as number, clip.duration)
    } catch {
      return []
    }
  })
}
