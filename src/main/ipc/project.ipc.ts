import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types/project'
import { v4 as uuidv4 } from 'uuid'
import * as projectStore from '../services/project-store'
import { getSetting, setSetting } from '../services/settings'
import { exportArchive, importArchive } from '../services/archive'
import { assertTrustedIPCEvent } from './security'

export function registerProjectIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    async (event, args: { name: string; inputMode: InputModeType; resolution: Resolution }) => {
      assertTrustedIPCEvent(event)
      return projectStore.createProject(uuidv4(), args.name, args.inputMode, args.resolution)
    },
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (event, id: string) => {
    assertTrustedIPCEvent(event)
    return projectStore.getProject(id)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async (event) => {
    assertTrustedIPCEvent(event)
    return projectStore.listProjects()
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE,
    async (event, args: { id: string; updates: Partial<Project> }) => {
      assertTrustedIPCEvent(event)
      return projectStore.updateProject(args.id, args.updates)
    },
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (event, id: string) => {
    assertTrustedIPCEvent(event)
    return projectStore.deleteProject(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_EXPORT,
    async (
      event,
      args: {
        projectId: string
        mediaFiles: string[]
        thumbnailFiles: string[]
        settings: Record<string, unknown>
      },
    ) => {
      assertTrustedIPCEvent(event)
      const result = await dialog.showSaveDialog({
        defaultPath: `project${'.leonardo'}`,
        filters: [{ name: 'Leonardo Project', extensions: ['leonardo'] }],
      })
      if (result.canceled || !result.filePath) return null

      const dbPath = projectStore.getDatabase().name
      return exportArchive({
        projectId: args.projectId,
        dbPath,
        mediaFiles: args.mediaFiles,
        thumbnailFiles: args.thumbnailFiles,
        settings: args.settings,
        outputPath: result.filePath,
      })
    },
  )

  ipcMain.handle(IPC_CHANNELS.ARCHIVE_IMPORT, async (event) => {
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

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (event, key: string) => {
    assertTrustedIPCEvent(event)
    return getSetting(key)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (event, args: { key: string; value: string }) => {
    assertTrustedIPCEvent(event)
    setSetting(args.key, args.value)
  })
}
