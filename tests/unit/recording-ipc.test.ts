// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'

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
  app: {
    getPath: (_name: string) => '/tmp/test-userData',
  },
}))

vi.mock('uuid', () => ({
  v4: () => 'test-recording-id',
}))

vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  },
  mkdirSync: vi.fn(),
  promises: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@main/services/dom-capture', () => ({
  startCapture: vi.fn(),
  stopCapture: vi.fn().mockReturnValue([]),
  handleDOMEvent: vi.fn(),
  isLeonardoEvent: vi.fn().mockReturnValue(false),
}))

vi.mock('@main/services/frame-capture', () => ({
  startFrameCapture: vi.fn(),
  stopFrameCapture: vi.fn().mockResolvedValue('/tmp/test-userData/recordings/test-recording-id/test-recording-id.mp4'),
  pauseFrameCapture: vi.fn(),
  resumeFrameCapture: vi.fn(),
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    RECORDING_START: 'recording:start',
    RECORDING_STOP: 'recording:stop',
    WORKER_STATUS: 'worker:status',
  },
}))

import * as fs from 'fs'
import { startCapture, stopCapture, handleDOMEvent, isLeonardoEvent } from '@main/services/dom-capture'
import { startFrameCapture, stopFrameCapture, pauseFrameCapture, resumeFrameCapture } from '@main/services/frame-capture'
import type { DOMEvent } from '@shared/types/events'

// Trusted IPC event object that satisfies assertTrustedIPCEvent
const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: { getURL: () => 'file:///renderer/index.html' },
}

// Helper to invoke a registered ipcMain.handle handler
async function invokeHandle(channel: string, args?: unknown): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, args)
}

// Helper to invoke a registered ipcMain.on listener
function emitOn(channel: string, data?: unknown): void {
  const listener = mockIpcListeners.get(channel)
  if (!listener) throw new Error(`No listener registered for channel: ${channel}`)
  listener(TRUSTED_EVENT, data)
}

// Import registerRecordingIPC after all mocks are set up
import { registerRecordingIPC, _resetRegistrationForTesting } from '@main/ipc/recording.ipc'

describe('recording IPC handlers', () => {
  beforeEach(() => {
    mockIpcHandlers.clear()
    mockIpcListeners.clear()
    vi.clearAllMocks()
    // Reset registration guard and clear session so handlers re-register fresh for each test
    _resetRegistrationForTesting()
    registerRecordingIPC()
  })

  // -----------------------------------------------------------------------
  // RECORDING_START
  // -----------------------------------------------------------------------
  describe('recording:start', () => {
    it('creates a session, calls startCapture and startFrameCapture, returns success', async () => {
      const result = (await invokeHandle('recording:start', {
        webviewId: 42,
        projectId: 'p-1',
      })) as { success: boolean; recordingId: string; outputDir: string }

      expect(result.success).toBe(true)
      expect(result.recordingId).toBe('test-recording-id')
      expect(result.outputDir).toBe(
        join('/tmp/test-userData', 'recordings', 'test-recording-id'),
      )

      expect(startCapture).toHaveBeenCalledWith(42)
      expect(startFrameCapture).toHaveBeenCalledWith(
        42,
        join('/tmp/test-userData', 'recordings', 'test-recording-id', 'test-recording-id.mp4'),
      )
      expect(fs.mkdirSync).toHaveBeenCalledWith(result.outputDir, { recursive: true })
    })

    it('returns error if already recording', async () => {
      // Start first session
      await invokeHandle('recording:start', { webviewId: 1, projectId: 'p-1' })

      // Attempt second start
      const result = (await invokeHandle('recording:start', {
        webviewId: 2,
        projectId: 'p-2',
      })) as { success: boolean; error: string }

      expect(result.success).toBe(false)
      expect(result.error).toBe('Recording already in progress')
    })
  })

  // -----------------------------------------------------------------------
  // RECORDING_STOP
  // -----------------------------------------------------------------------
  describe('recording:stop', () => {
    it('stops capture, stops frame capture, saves events JSON, returns videoPath', async () => {
      const sampleEvents: DOMEvent[] = [
        {
          id: 'e1',
          type: 'click',
          timestamp: 1000,
          elementSelector: 'button',
          coordinates: { x: 10, y: 20 },
        },
      ]
      vi.mocked(stopCapture).mockReturnValueOnce(sampleEvents)

      const expectedVideoPath =
        '/tmp/test-userData/recordings/test-recording-id/test-recording-id.mp4'
      vi.mocked(stopFrameCapture).mockResolvedValueOnce(expectedVideoPath)

      await invokeHandle('recording:start', { webviewId: 42, projectId: 'p-1' })

      const result = (await invokeHandle('recording:stop')) as {
        success: boolean
        recordingId: string
        videoPath: string
        outputDir: string
        domEvents: DOMEvent[]
        duration: number
      }

      expect(result.success).toBe(true)
      expect(result.recordingId).toBe('test-recording-id')
      expect(result.videoPath).toBe(expectedVideoPath)
      expect(result.domEvents).toEqual(sampleEvents)
      expect(typeof result.duration).toBe('number')

      expect(stopCapture).toHaveBeenCalledWith(42)
      expect(stopFrameCapture).toHaveBeenCalled()

      // Events JSON should be saved
      const expectedEventsPath = join(
        '/tmp/test-userData/recordings/test-recording-id',
        'test-recording-id.events.json',
      )
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expectedEventsPath,
        JSON.stringify(sampleEvents, null, 2),
      )
    })

    it('returns error if no session is active', async () => {
      const result = (await invokeHandle('recording:stop')) as {
        success: boolean
        error: string
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('No recording in progress')
    })
  })

  // -----------------------------------------------------------------------
  // Pause / Resume
  // -----------------------------------------------------------------------
  describe('recording:pause', () => {
    it('calls pauseFrameCapture when session is active', async () => {
      await invokeHandle('recording:start', { webviewId: 5, projectId: 'p-1' })

      const result = (await invokeHandle('recording:pause')) as { success: boolean }

      expect(result.success).toBe(true)
      expect(pauseFrameCapture).toHaveBeenCalled()
    })

    it('returns success even when no session is active', async () => {
      const result = (await invokeHandle('recording:pause')) as { success: boolean }
      expect(result.success).toBe(true)
      expect(pauseFrameCapture).not.toHaveBeenCalled()
    })
  })

  describe('recording:resume', () => {
    it('calls resumeFrameCapture when session is active', async () => {
      await invokeHandle('recording:start', { webviewId: 5, projectId: 'p-1' })

      const result = (await invokeHandle('recording:resume')) as { success: boolean }

      expect(result.success).toBe(true)
      expect(resumeFrameCapture).toHaveBeenCalled()
    })

    it('returns success even when no session is active', async () => {
      const result = (await invokeHandle('recording:resume')) as { success: boolean }
      expect(result.success).toBe(true)
      expect(resumeFrameCapture).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // WORKER_STATUS
  // -----------------------------------------------------------------------
  describe('worker:status', () => {
    it('returns idle status when no session is active', async () => {
      const result = (await invokeHandle('worker:status')) as {
        isRecording: boolean
        recordingId: string | null
        status: string
        duration: number
      }

      expect(result.isRecording).toBe(false)
      expect(result.recordingId).toBeNull()
      expect(result.status).toBe('idle')
    })

    it('returns recording status when session is active', async () => {
      await invokeHandle('recording:start', { webviewId: 7, projectId: 'p-1' })

      const result = (await invokeHandle('worker:status')) as {
        isRecording: boolean
        recordingId: string | null
        status: string
        duration: number
      }

      expect(result.isRecording).toBe(true)
      expect(result.recordingId).toBe('test-recording-id')
      expect(result.status).toBe('recording')
    })
  })

  // -----------------------------------------------------------------------
  // recording:get-webview-preload-path
  // -----------------------------------------------------------------------
  describe('recording:get-webview-preload-path', () => {
    it('returns a file:// path containing webview-preload.js', async () => {
      const result = (await invokeHandle('recording:get-webview-preload-path')) as string
      expect(result).toContain('webview-preload.js')
      expect(result).toMatch(/^file:\/\//)
    })
  })

  // -----------------------------------------------------------------------
  // dom-event-relay listener
  // -----------------------------------------------------------------------
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

    it('does NOT call handleDOMEvent when event is not a Leonardo event', async () => {
      vi.mocked(isLeonardoEvent).mockReturnValue(false)

      await invokeHandle('recording:start', { webviewId: 7, projectId: 'proj-x' })

      emitOn('dom-event-relay', { type: 'unknown' })

      expect(handleDOMEvent).not.toHaveBeenCalled()
    })
  })
})
