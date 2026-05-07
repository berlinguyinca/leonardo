import { dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types/project'
import { v4 as uuidv4 } from 'uuid'
import * as projectStore from '../services/project-store'
import { getSetting, setSetting } from '../services/settings'
import { exportArchive, importArchive } from '../services/archive'
import { assertTrustedIPCEvent } from './security'
import { safeHandle } from './safe-handle'

export function registerProjectIPC(): void {
  safeHandle(
    IPC_CHANNELS.PROJECT_CREATE,
    async (event, args: unknown) => {
      assertTrustedIPCEvent(event)
      const { name, inputMode, resolution } = args as { name: string; inputMode: InputModeType; resolution: Resolution }
      return projectStore.createProject(uuidv4(), name, inputMode, resolution)
    },
  )

  safeHandle(IPC_CHANNELS.PROJECT_GET, async (event, id: unknown) => {
    assertTrustedIPCEvent(event)
    return projectStore.getProject(id as string)
  })

  safeHandle(IPC_CHANNELS.PROJECT_LIST, async (event) => {
    assertTrustedIPCEvent(event)
    return projectStore.listProjects()
  })

  safeHandle(
    IPC_CHANNELS.PROJECT_UPDATE,
    async (event, args: unknown) => {
      assertTrustedIPCEvent(event)
      const { id, updates } = args as { id: string; updates: Partial<Project> }
      return projectStore.updateProject(id, updates)
    },
  )

  safeHandle(IPC_CHANNELS.PROJECT_DELETE, async (event, id: unknown) => {
    assertTrustedIPCEvent(event)
    return projectStore.deleteProject(id as string)
  })

  safeHandle(
    IPC_CHANNELS.ARCHIVE_EXPORT,
    async (event, args: unknown) => {
      assertTrustedIPCEvent(event)
      const { projectId, mediaFiles, thumbnailFiles, settings } = args as {
        projectId: string
        mediaFiles: string[]
        thumbnailFiles: string[]
        settings: Record<string, unknown>
      }
      const result = await dialog.showSaveDialog({
        defaultPath: `project${'.leonardo'}`,
        filters: [{ name: 'Leonardo Project', extensions: ['leonardo'] }],
      })
      if (result.canceled || !result.filePath) return null

      const dbPath = projectStore.getDatabase().name
      return exportArchive({
        projectId,
        dbPath,
        mediaFiles,
        thumbnailFiles,
        settings,
        outputPath: result.filePath,
      })
    },
  )

  safeHandle(IPC_CHANNELS.ARCHIVE_IMPORT, async (event) => {
    assertTrustedIPCEvent(event)
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Leonardo Project', extensions: ['leonardo'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const { app } = require('electron')
    const { join } = require('path')
    const extractDir = join(app.getPath('userData'), 'imports', uuidv4())

    return importArchive(result.filePaths[0], extractDir)
  })

  safeHandle(IPC_CHANNELS.SETTINGS_GET, async (event, key: unknown) => {
    assertTrustedIPCEvent(event)
    return getSetting(key as string)
  })

  safeHandle(IPC_CHANNELS.SETTINGS_SET, async (event, args: unknown) => {
    assertTrustedIPCEvent(event)
    const { key, value } = args as { key: string; value: string }
    setSetting(key, value)
  })
}
