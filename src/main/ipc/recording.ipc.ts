import { ipcMain } from 'electron'
import { join } from 'path'
import { app } from 'electron'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS } from '@shared/constants'
import { startCapture, stopCapture, handleDOMEvent, isLeonardoEvent } from '../services/dom-capture'
import { startFrameCapture, stopFrameCapture, pauseFrameCapture, resumeFrameCapture } from '../services/frame-capture'
import { assertTrustedIPCEvent } from './security'

interface RecordingSession {
  id: string
  projectId: string
  webContentsId: number
  status: 'recording' | 'paused' | 'stopped'
  startTime: number
  outputDir: string
  videoPath: string
}

let currentSession: RecordingSession | null = null

let registered = false

/** Reset module state — for use in unit tests only. */
export function _resetRegistrationForTesting(): void {
  registered = false
  currentSession = null
}

export function registerRecordingIPC(): void {
  if (registered) return
  registered = true

  ipcMain.handle(
    IPC_CHANNELS.RECORDING_START,
    async (event, args: { webviewId: number; projectId?: string }) => {
      assertTrustedIPCEvent(event)
      if (currentSession) {
        return { success: false, error: 'Recording already in progress' }
      }

      const recordingId = uuidv4()
      const outputDir = join(app.getPath('userData'), 'recordings', recordingId)
      fs.mkdirSync(outputDir, { recursive: true })

      const videoPath = join(outputDir, `${recordingId}.mp4`)

      currentSession = {
        id: recordingId,
        projectId: args.projectId ?? '',
        webContentsId: args.webviewId,
        status: 'recording',
        startTime: Date.now(),
        outputDir,
        videoPath,
      }

      // Start DOM event capture
      startCapture(args.webviewId)

      // Start frame capture → FFmpeg pipeline
      let frameCaptureWarning: string | undefined
      try {
        startFrameCapture(args.webviewId, videoPath)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[Recording] Frame capture failed:', msg)
        frameCaptureWarning = `Video capture unavailable: ${msg}`
      }

      return {
        success: true,
        recordingId,
        outputDir,
        warning: frameCaptureWarning,
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async (event) => {
    assertTrustedIPCEvent(event)
    if (!currentSession) {
      return { success: false, error: 'No recording in progress' }
    }

    const session = currentSession
    currentSession = null

    // Stop DOM capture and collect events
    const domEvents = stopCapture(session.webContentsId)

    // Stop frame capture and finalize the MP4
    let videoPath = ''
    try {
      videoPath = await stopFrameCapture()
    } catch (err) {
      console.warn('[Recording] Frame capture stop failed:', err)
    }

    // Save DOM events to JSON
    const eventsPath = join(session.outputDir, `${session.id}.events.json`)
    await fs.promises.writeFile(eventsPath, JSON.stringify(domEvents, null, 2))

    return {
      success: true,
      recordingId: session.id,
      videoPath: videoPath || session.videoPath,
      outputDir: session.outputDir,
      domEvents,
      duration: Date.now() - session.startTime,
    }
  })

  // Pause/resume control the frame capture interval
  ipcMain.handle('recording:pause', async (event) => {
    assertTrustedIPCEvent(event)
    if (currentSession) {
      currentSession.status = 'paused'
      pauseFrameCapture()
    }
    return { success: true }
  })

  ipcMain.handle('recording:resume', async (event) => {
    assertTrustedIPCEvent(event)
    if (currentSession) {
      currentSession.status = 'recording'
      resumeFrameCapture()
    }
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.WORKER_STATUS, async (event) => {
    assertTrustedIPCEvent(event)
    return {
      isRecording: currentSession !== null,
      recordingId: currentSession?.id ?? null,
      status: currentSession?.status ?? 'idle',
      duration: currentSession ? Date.now() - currentSession.startTime : 0,
    }
  })

  // Expose webview preload path to the renderer
  ipcMain.handle('recording:get-webview-preload-path', (event) => {
    assertTrustedIPCEvent(event)
    return 'file://' + join(__dirname, '../preload/webview-preload.js')
  })

  // DOM events are relayed from renderer (which listens on the <webview> ipc-message event)
  ipcMain.on('dom-event-relay', (event, data) => {
    assertTrustedIPCEvent(event)
    if (currentSession && isLeonardoEvent(data)) {
      handleDOMEvent(currentSession.webContentsId, data)
    }
  })
}
