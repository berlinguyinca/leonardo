import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types/project'
import { v4 as uuidv4 } from 'uuid'
import * as projectStore from '../services/project-store'
import { exportArchive, importArchive } from '../services/archive'

export function registerProjectIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    async (_event, args: { name: string; inputMode: InputModeType; resolution: Resolution }) => {
      return projectStore.createProject(uuidv4(), args.name, args.inputMode, args.resolution)
    },
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (_event, id: string) => {
    return projectStore.getProject(id)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return projectStore.listProjects()
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE,
    async (_event, args: { id: string; updates: Partial<Project> }) => {
      return projectStore.updateProject(args.id, args.updates)
    },
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, id: string) => {
    return projectStore.deleteProject(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.ARCHIVE_EXPORT,
    async (
      _event,
      args: {
        projectId: string
        mediaFiles: string[]
        thumbnailFiles: string[]
        settings: Record<string, unknown>
      },
    ) => {
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

  ipcMain.handle(IPC_CHANNELS.ARCHIVE_IMPORT, async () => {
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
}
