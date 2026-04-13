import { IPC_CHANNELS } from '@shared/constants'
import type { SyncTimeline } from '@shared/types'
import * as projectStore from '../services/project-store'
import { assertTrustedIPCEvent } from './security'
import { safeHandle } from './safe-handle'

export function registerTimelineIPC(): void {
  safeHandle(
    IPC_CHANNELS.TIMELINE_SAVE,
    async (event, timeline: unknown) => {
      assertTrustedIPCEvent(event)
      projectStore.saveTimeline(timeline as SyncTimeline)
    },
  )

  safeHandle(
    IPC_CHANNELS.TIMELINE_GET,
    async (event, projectId: unknown) => {
      assertTrustedIPCEvent(event)
      return projectStore.getTimeline(projectId as string)
    },
  )

  safeHandle(
    IPC_CHANNELS.TIMELINE_DELETE,
    async (event, projectId: unknown) => {
      assertTrustedIPCEvent(event)
      return projectStore.deleteTimeline(projectId as string)
    },
  )
}
