import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import * as fs from 'fs'

// ---- mock electron before any imports that use it ----
const mockIpcHandlers: Map<string, Function> = new Map()
const mockIpcListeners: Map<string, Function> = new Map()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Function) => {
      mockIpcHandlers.set(channel, handler)
    },
    on: (channel: string, handler: Function) => {
      mockIpcListeners.set(channel, handler)
    },
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
  app: {
    getPath: () => '/tmp/test-userData',
  },
}))

vi.mock('uuid', () => ({
  v4: () => 'test-recording-id',
}))

vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  mkdirSync: vi.fn(),
}))

vi.mock('@main/services/dom-capture', () => ({
  startCapture: vi.fn(),
  stopCapture: vi.fn().mockReturnValue([]),
  handleDOMEvent: vi.fn(),
  isLeonardoEvent: vi.fn().mockReturnValue(false),
}))

vi.mock('@main/workers/recording-worker', () => ({
  processRecording: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@main/utils/ffmpeg', () => ({
  getFFmpegPath: () => 'ffmpeg',
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    RECORDING_START: 'recording:start',
    RECORDING_STOP: 'recording:stop',
    RENDER_PROGRESS: 'render:progress',
    WORKER_STATUS: 'worker:status',
  },
}))

import { stopCapture, handleDOMEvent, isLeonardoEvent } from '@main/services/dom-capture'
import type { DOMEvent } from '@shared/types/events'

// Helper to invoke a registered ipcMain.handle handler
async function invokeHandle(channel: string, args?: unknown): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler({} /* _event */, args)
}

// Helper to invoke a registered ipcMain.on listener
function emitOn(channel: string, data?: unknown): void {
  const listener = mockIpcListeners.get(channel)
  if (!listener) throw new Error(`No listener registered for channel: ${channel}`)
  listener({} /* _event */, data)
}

// Import registerRecordingIPC after all mocks are set up
import { registerRecordingIPC, _resetRegistrationForTesting } from '@main/ipc/recording.ipc'

describe('recording IPC handlers', () => {
  beforeEach(() => {
    mockIpcHandlers.clear()
    mockIpcListeners.clear()
    vi.clearAllMocks()
    // Reset registration guard so handlers re-register fresh for each test
    _resetRegistrationForTesting()
    registerRecordingIPC()
  })

  describe('recording:save-blob', () => {
    it('writes buffer to outputDir/recording.webm', async () => {
      const buffer = new ArrayBuffer(8)
      const result = await invokeHandle('recording:save-blob', {
        outputDir: '/tmp/out',
        buffer,
      })

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        join('/tmp/out', 'recording.webm'),
        Buffer.from(buffer),
      )
      expect(result).toEqual({
        success: true,
        webmPath: join('/tmp/out', 'recording.webm'),
      })
    })

    it('returns the correct webmPath', async () => {
      const buffer = new ArrayBuffer(4)
      const result = (await invokeHandle('recording:save-blob', {
        outputDir: '/custom/path',
        buffer,
      })) as { success: boolean; webmPath: string }

      expect(result.webmPath).toBe(join('/custom/path', 'recording.webm'))
    })
  })

  describe('recording:get-webview-preload-path', () => {
    it('returns a path containing webview-preload.js', async () => {
      const result = (await invokeHandle('recording:get-webview-preload-path')) as string
      expect(result).toContain('webview-preload.js')
    })
  })

  describe('pendingEvents — stop then convert', () => {
    const sampleEvents: DOMEvent[] = [
      {
        id: 'e1',
        type: 'click',
        timestamp: 1000,
        elementSelector: 'button',
        coordinates: { x: 10, y: 20 },
      },
    ]

    it('recording:convert receives events captured at stop time', async () => {
      // Arrange: stopCapture returns our sample events
      vi.mocked(stopCapture).mockReturnValueOnce(sampleEvents)

      // Act: start a session
      await invokeHandle('recording:start', { webviewId: 42, projectId: 'p-1' })
      // Stop — stores events in pendingEvents
      const stopResult = (await invokeHandle('recording:stop')) as {
        success: boolean
        recordingId: string
        outputDir: string
        domEvents: DOMEvent[]
      }
      expect(stopResult.success).toBe(true)
      const { recordingId, outputDir } = stopResult

      // Convert — should retrieve stored events
      const { processRecording } = await import('@main/workers/recording-worker')
      await invokeHandle('recording:convert', {
        recordingId,
        webmPath: join(outputDir, 'recording.webm'),
        outputDir,
        projectId: 'p-1',
      })

      expect(processRecording).toHaveBeenCalledWith(
        expect.objectContaining({ domEvents: sampleEvents }),
        expect.any(Function),
      )
    })

    it('pendingEvents is cleared after recording:convert', async () => {
      vi.mocked(stopCapture).mockReturnValueOnce(sampleEvents)

      await invokeHandle('recording:start', { webviewId: 99, projectId: 'p-2' })
      const stopResult = (await invokeHandle('recording:stop')) as {
        success: boolean
        recordingId: string
        outputDir: string
      }
      const { recordingId, outputDir } = stopResult

      const { processRecording } = await import('@main/workers/recording-worker')

      // First convert — receives events
      await invokeHandle('recording:convert', {
        recordingId,
        webmPath: join(outputDir, 'recording.webm'),
        outputDir,
        projectId: 'p-2',
      })

      vi.mocked(processRecording).mockClear()

      // Second convert with same recordingId — events should be gone (empty array)
      await invokeHandle('recording:convert', {
        recordingId,
        webmPath: join(outputDir, 'recording.webm'),
        outputDir,
        projectId: 'p-2',
      })

      expect(processRecording).toHaveBeenCalledWith(
        expect.objectContaining({ domEvents: [] }),
        expect.any(Function),
      )
    })
  })

  describe('dom-event-relay listener', () => {
    it('registers a dom-event-relay listener on ipcMain', () => {
      expect(mockIpcListeners.has('dom-event-relay')).toBe(true)
    })

    it('calls handleDOMEvent when session is active and data is a valid Leonardo event', async () => {
      vi.mocked(isLeonardoEvent).mockReturnValue(true)

      const sampleEvent: DOMEvent = {
        id: 'e2',
        type: 'click',
        timestamp: 2000,
        elementSelector: 'div',
        coordinates: { x: 5, y: 10 },
      }

      // Start a session so currentSession is set
      await invokeHandle('recording:start', { webviewId: 7, projectId: 'proj-x' })

      emitOn('dom-event-relay', sampleEvent)

      expect(handleDOMEvent).toHaveBeenCalledWith(7, sampleEvent)
    })

    it('does NOT call handleDOMEvent when no session is active', () => {
      vi.mocked(isLeonardoEvent).mockReturnValue(true)

      const sampleEvent: DOMEvent = {
        id: 'e3',
        type: 'click',
        timestamp: 3000,
        elementSelector: 'span',
        coordinates: { x: 1, y: 2 },
      }

      // No session started — emitting should be a no-op
      emitOn('dom-event-relay', sampleEvent)

      expect(handleDOMEvent).not.toHaveBeenCalled()
    })
  })
})
