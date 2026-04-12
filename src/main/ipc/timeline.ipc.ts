import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { SyncTimeline } from '@shared/types'
import * as projectStore from '../services/project-store'
import { assertTrustedIPCEvent } from './security'

export function registerTimelineIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.TIMELINE_SAVE,
    async (event, timeline: SyncTimeline) => {
      assertTrustedIPCEvent(event)
      projectStore.saveTimeline(timeline)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TIMELINE_GET,
    async (event, projectId: string) => {
      assertTrustedIPCEvent(event)
      return projectStore.getTimeline(projectId)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.TIMELINE_DELETE,
    async (event, projectId: string) => {
      assertTrustedIPCEvent(event)
      return projectStore.deleteTimeline(projectId)
    },
  )
}
