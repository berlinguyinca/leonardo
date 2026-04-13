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
  dialog: {
    showSaveDialog: vi.fn(),
  },
}))

const mockCreateClip = vi.fn()
const mockListClips = vi.fn()
const mockDeleteClip = vi.fn()
const mockGetDatabase = vi.fn()

vi.mock('@main/services/project-store', () => ({
  createClip: (...args: unknown[]) => mockCreateClip(...args),
  listClips: (...args: unknown[]) => mockListClips(...args),
  deleteClip: (...args: unknown[]) => mockDeleteClip(...args),
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    promises: {
      rm: vi.fn().mockResolvedValue(undefined),
      copyFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn(),
    },
  },
  promises: {
    rm: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
  },
}))

const mockExtractThumbnails = vi.fn()

vi.mock('@main/utils/ffmpeg', () => ({
  extractThumbnails: (...args: unknown[]) => mockExtractThumbnails(...args),
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    CLIP_CREATE: 'clip:create',
    CLIP_LIST: 'clip:list',
    CLIP_DELETE: 'clip:delete',
    CLIP_EXPORT: 'clip:export',
    CLIP_GET_EVENTS: 'clip:get-events',
    CLIP_GET_THUMBNAILS: 'clip:get-thumbnails',
  },
}))

import * as fs from 'fs'
import { dialog } from 'electron'
import { registerClipIPC } from '@main/ipc/clip.ipc'
import { makeClip } from '@test/factories'

const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: { getURL: () => 'file:///renderer/index.html' },
}

async function invokeHandle(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, ...args)
}

describe('clip IPC handlers', () => {
  beforeEach(() => {
    mockIpcHandlers.clear()
    vi.clearAllMocks()

    // Default stub: listClips returns empty array
    mockListClips.mockReturnValue([])

    // Default stub: db with no-op prepare
    const mockRun = vi.fn()
    const mockPrepare = vi.fn().mockReturnValue({ run: mockRun })
    mockGetDatabase.mockReturnValue({ prepare: mockPrepare })

    registerClipIPC()
  })

  // -----------------------------------------------------------------------
  // CLIP_CREATE
  // -----------------------------------------------------------------------
  describe('clip:create', () => {
    it('delegates to createClip and returns the result', async () => {
      const clip = makeClip()
      mockCreateClip.mockReturnValue(clip)

      const result = await invokeHandle('clip:create', clip)

      expect(mockCreateClip).toHaveBeenCalledWith(clip)
      expect(result).toEqual(clip)
    })
  })

  // -----------------------------------------------------------------------
  // CLIP_LIST
  // -----------------------------------------------------------------------
  describe('clip:list', () => {
    it('returns all clips when no projectId provided', async () => {
      const clips = [makeClip(), makeClip({ id: 'clip-2' })]
      mockListClips.mockReturnValue(clips)

      const result = await invokeHandle('clip:list')

      expect(mockListClips).toHaveBeenCalledWith(undefined)
      expect(result).toEqual(clips)
    })

    it('filters by projectId when provided', async () => {
      const clips = [makeClip({ projectId: 'proj-99' })]
      mockListClips.mockReturnValue(clips)

      const result = await invokeHandle('clip:list', 'proj-99')

      expect(mockListClips).toHaveBeenCalledWith('proj-99')
      expect(result).toEqual(clips)
    })
  })

  // -----------------------------------------------------------------------
  // CLIP_DELETE
  // -----------------------------------------------------------------------
  describe('clip:delete', () => {
    it('deletes scripts and sections from DB, removes recording dir, then deletes clip', async () => {
      const clip = makeClip({ id: 'clip-del', filePath: '/recordings/session/clip.mp4' })
      mockListClips.mockReturnValue([clip])
      mockDeleteClip.mockReturnValue(true)

      const result = await invokeHandle('clip:delete', 'clip-del')

      // DB cascade deletes
      expect(mockGetDatabase).toHaveBeenCalled()
      const db = mockGetDatabase.mock.results[0].value
      expect(db.prepare).toHaveBeenCalledWith(
        'DELETE FROM script_sections WHERE script_id IN (SELECT id FROM scripts WHERE clip_id = ?)',
      )
      expect(db.prepare).toHaveBeenCalledWith('DELETE FROM scripts WHERE clip_id = ?')

      // Directory removal — dirname of /recordings/session/clip.mp4 = /recordings/session
      expect(fs.promises.rm).toHaveBeenCalledWith('/recordings/session', {
        recursive: true,
        force: true,
      })

      // Final clip delete
      expect(mockDeleteClip).toHaveBeenCalledWith('clip-del')
      expect(result).toBe(true)
    })

    it('skips directory deletion when clip is not found', async () => {
      mockListClips.mockReturnValue([])
      mockDeleteClip.mockReturnValue(false)

      const result = await invokeHandle('clip:delete', 'no-such-clip')

      expect(fs.promises.rm).not.toHaveBeenCalled()
      expect(mockDeleteClip).toHaveBeenCalledWith('no-such-clip')
      expect(result).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // CLIP_EXPORT
  // -----------------------------------------------------------------------
  describe('clip:export', () => {
    it('copies the file to the chosen path and returns success', async () => {
      const clip = makeClip({ id: 'clip-exp', filePath: '/recordings/clip.mp4' })
      mockListClips.mockResolvedValue([clip])
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: '/output/export.mp4',
        canceled: false,
      })

      const result = (await invokeHandle('clip:export', 'clip-exp')) as {
        success: boolean
        outputPath: string
      }

      expect(result.success).toBe(true)
      expect(result.outputPath).toBe('/output/export.mp4')
      expect(fs.promises.copyFile).toHaveBeenCalledWith('/recordings/clip.mp4', '/output/export.mp4')
    })

    it('returns error when clip is not found', async () => {
      mockListClips.mockResolvedValue([])

      const result = (await invokeHandle('clip:export', 'missing-clip')) as {
        success: boolean
        error: string
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('Clip not found')
    })

    it('returns error when user cancels the save dialog', async () => {
      const clip = makeClip({ id: 'clip-cancel' })
      mockListClips.mockResolvedValue([clip])
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: undefined,
        canceled: true,
      })

      const result = (await invokeHandle('clip:export', 'clip-cancel')) as {
        success: boolean
        error: string
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cancelled')
    })

    it('returns error when copyFile throws', async () => {
      const clip = makeClip({ id: 'clip-err', filePath: '/recordings/clip.mp4' })
      mockListClips.mockResolvedValue([clip])
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: '/output/export.mp4',
        canceled: false,
      })
      vi.mocked(fs.promises.copyFile).mockRejectedValueOnce(new Error('disk full'))

      const result = (await invokeHandle('clip:export', 'clip-err')) as {
        success: boolean
        error: string
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('disk full')
    })
  })

  // -----------------------------------------------------------------------
  // CLIP_GET_EVENTS
  // -----------------------------------------------------------------------
  describe('clip:get-events', () => {
    it('returns parsed JSON events from the events file', async () => {
      const clip = makeClip({ id: 'clip-ev', filePath: '/recordings/session/clip.mp4' })
      mockListClips.mockResolvedValue([clip])
      const events = [{ id: 'e1', type: 'click' }]
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify(events) as unknown as Buffer)

      const result = await invokeHandle('clip:get-events', 'clip-ev')

      expect(fs.promises.readFile).toHaveBeenCalledWith(
        '/recordings/session/clip.events.json',
        'utf-8',
      )
      expect(result).toEqual(events)
    })

    it('returns empty array when clip is not found', async () => {
      mockListClips.mockResolvedValue([])

      const result = await invokeHandle('clip:get-events', 'no-clip')

      expect(result).toEqual([])
    })

    it('returns empty array when events file is missing or unreadable', async () => {
      const clip = makeClip({ id: 'clip-nofile', filePath: '/recordings/session/clip.mp4' })
      mockListClips.mockResolvedValue([clip])
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('ENOENT'))

      const result = await invokeHandle('clip:get-events', 'clip-nofile')

      expect(result).toEqual([])
    })
  })

  // -----------------------------------------------------------------------
  // CLIP_GET_THUMBNAILS
  // -----------------------------------------------------------------------
  describe('clip:get-thumbnails', () => {
    it('delegates to extractThumbnails and returns the result', async () => {
      const clip = makeClip({
        id: 'clip-thumb',
        filePath: '/recordings/session/clip.mp4',
        duration: 10000,
      })
      mockListClips.mockResolvedValue([clip])
      const thumbs = ['/recordings/session/thumb_001.jpg', '/recordings/session/thumb_002.jpg']
      mockExtractThumbnails.mockResolvedValue(thumbs)

      const result = await invokeHandle('clip:get-thumbnails', 'clip-thumb', 2)

      expect(mockExtractThumbnails).toHaveBeenCalledWith(
        '/recordings/session/clip.mp4',
        '/recordings/session',
        2,
        10000,
      )
      expect(result).toEqual(thumbs)
    })

    it('returns empty array when clip is not found', async () => {
      mockListClips.mockResolvedValue([])

      const result = await invokeHandle('clip:get-thumbnails', 'no-clip', 5)

      expect(result).toEqual([])
      expect(mockExtractThumbnails).not.toHaveBeenCalled()
    })

    it('returns empty array when extractThumbnails throws', async () => {
      const clip = makeClip({ id: 'clip-fail', filePath: '/recordings/session/clip.mp4' })
      mockListClips.mockResolvedValue([clip])
      mockExtractThumbnails.mockRejectedValueOnce(new Error('ffmpeg not found'))

      const result = await invokeHandle('clip:get-thumbnails', 'clip-fail', 3)

      expect(result).toEqual([])
    })
  })
})
