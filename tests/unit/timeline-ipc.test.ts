// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mock electron before any source imports ----
const mockIpcHandlers: Map<string, Function> = new Map()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Function) => {
      mockIpcHandlers.set(channel, handler)
    },
  },
}))

const mockSaveTimeline = vi.fn()
const mockGetTimeline = vi.fn()
const mockDeleteTimeline = vi.fn()

vi.mock('@main/services/project-store', () => ({
  saveTimeline: (...args: unknown[]) => mockSaveTimeline(...args),
  getTimeline: (...args: unknown[]) => mockGetTimeline(...args),
  deleteTimeline: (...args: unknown[]) => mockDeleteTimeline(...args),
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    TIMELINE_SAVE: 'timeline:save',
    TIMELINE_GET: 'timeline:get',
    TIMELINE_DELETE: 'timeline:delete',
  },
}))

import { registerTimelineIPC } from '@main/ipc/timeline.ipc'
import { makeTimeline } from '@test/factories'

const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: { getURL: () => 'file:///renderer/index.html' },
}

async function invokeHandle(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, ...args)
}

describe('timeline IPC handlers', () => {
  beforeEach(() => {
    mockIpcHandlers.clear()
    vi.clearAllMocks()
    registerTimelineIPC()
  })

  // -----------------------------------------------------------------------
  // TIMELINE_SAVE
  // -----------------------------------------------------------------------
  describe('timeline:save', () => {
    it('delegates to saveTimeline with the provided timeline object', async () => {
      const timeline = makeTimeline()
      mockSaveTimeline.mockReturnValue(undefined)

      await invokeHandle('timeline:save', timeline)

      expect(mockSaveTimeline).toHaveBeenCalledWith(timeline)
      expect(mockSaveTimeline).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------
  // TIMELINE_GET
  // -----------------------------------------------------------------------
  describe('timeline:get', () => {
    it('returns the timeline for the given projectId', async () => {
      const timeline = makeTimeline({ projectId: 'proj-42' })
      mockGetTimeline.mockReturnValue(timeline)

      const result = await invokeHandle('timeline:get', 'proj-42')

      expect(mockGetTimeline).toHaveBeenCalledWith('proj-42')
      expect(result).toEqual(timeline)
    })

    it('returns null when no timeline exists for the projectId', async () => {
      mockGetTimeline.mockReturnValue(null)

      const result = await invokeHandle('timeline:get', 'proj-missing')

      expect(mockGetTimeline).toHaveBeenCalledWith('proj-missing')
      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // TIMELINE_DELETE
  // -----------------------------------------------------------------------
  describe('timeline:delete', () => {
    it('delegates to deleteTimeline and returns true when deleted', async () => {
      mockDeleteTimeline.mockReturnValue(true)

      const result = await invokeHandle('timeline:delete', 'proj-del')

      expect(mockDeleteTimeline).toHaveBeenCalledWith('proj-del')
      expect(result).toBe(true)
    })

    it('returns false when no timeline existed for the projectId', async () => {
      mockDeleteTimeline.mockReturnValue(false)

      const result = await invokeHandle('timeline:delete', 'proj-none')

      expect(mockDeleteTimeline).toHaveBeenCalledWith('proj-none')
      expect(result).toBe(false)
    })
  })
})
