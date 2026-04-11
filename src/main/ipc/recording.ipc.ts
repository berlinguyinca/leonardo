import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { app } from 'electron'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS } from '@shared/constants'
import { startCapture, stopCapture, handleDOMEvent, isLeonardoEvent } from '../services/dom-capture'
import { processRecording } from '../workers/recording-worker'
import { getFFmpegPath } from '../utils/ffmpeg'
import type { DOMEvent } from '@shared/types/events'

interface RecordingSession {
  id: string
  projectId: string
  webContentsId: number
  status: 'recording' | 'paused' | 'stopped'
  startTime: number
  outputDir: string
}

let currentSession: RecordingSession | null = null

// Store DOM events by recording ID so recording:convert can retrieve them
const pendingEvents: Map<string, DOMEvent[]> = new Map()

export function registerRecordingIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.RECORDING_START,
    async (_event, args: { webviewId: number; projectId?: string }) => {
      if (currentSession) {
        return { success: false, error: 'Recording already in progress' }
      }

      const recordingId = uuidv4()
      const outputDir = join(app.getPath('userData'), 'recordings', recordingId)
      const { mkdirSync } = require('fs')
      mkdirSync(outputDir, { recursive: true })

      currentSession = {
        id: recordingId,
        projectId: args.projectId ?? '',
        webContentsId: args.webviewId,
        status: 'recording',
        startTime: Date.now(),
        outputDir,
      }

      // Start DOM event capture
      startCapture(args.webviewId)

      return {
        success: true,
        recordingId,
        outputDir,
      }
    },
  )

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async () => {
    if (!currentSession) {
      return { success: false, error: 'No recording in progress' }
    }

    const session = currentSession
    currentSession = null

    // Stop DOM capture and collect events
    const domEvents = stopCapture(session.webContentsId)

    // Store events keyed by recording ID for recording:convert to pick up
    pendingEvents.set(session.id, domEvents)

    // The renderer will have saved the WebM blob via MediaRecorder.
    // The IPC stop returns session info; the renderer sends the blob path separately.
    return {
      success: true,
      recordingId: session.id,
      outputDir: session.outputDir,
      domEvents,
      duration: Date.now() - session.startTime,
    }
  })

  // Handle conversion request after renderer saves the WebM file
  ipcMain.handle(
    'recording:convert',
    async (
      _event,
      args: { recordingId: string; webmPath: string; outputDir: string; projectId: string },
    ) => {
      // Retrieve events stored at stop time and clear them
      const domEvents = pendingEvents.get(args.recordingId) ?? []
      pendingEvents.delete(args.recordingId)

      const mainWindow = BrowserWindow.getAllWindows()[0]
      const result = await processRecording(
        {
          inputPath: args.webmPath,
          outputDir: args.outputDir,
          projectId: args.projectId,
          recordingId: args.recordingId,
          domEvents,
          ffmpegPath: getFFmpegPath(),
        },
        (progress) => {
          mainWindow?.webContents.send(IPC_CHANNELS.RENDER_PROGRESS, {
            recordingId: args.recordingId,
            ...progress,
          })
        },
      )

      return result
    },
  )

  // Pause/resume are simple state changes
  ipcMain.handle('recording:pause', async () => {
    if (currentSession) currentSession.status = 'paused'
    return { success: true }
  })

  ipcMain.handle('recording:resume', async () => {
    if (currentSession) currentSession.status = 'recording'
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.WORKER_STATUS, async () => {
    return {
      isRecording: currentSession !== null,
      recordingId: currentSession?.id ?? null,
      status: currentSession?.status ?? 'idle',
      duration: currentSession ? Date.now() - currentSession.startTime : 0,
    }
  })

  // Save WebM blob received from renderer to disk
  ipcMain.handle(
    'recording:save-blob',
    async (_event, args: { outputDir: string; buffer: ArrayBuffer }) => {
      const webmPath = join(args.outputDir, 'recording.webm')
      await fs.promises.writeFile(webmPath, Buffer.from(args.buffer))
      return { success: true, webmPath }
    },
  )

  // Expose webview preload path to the renderer
  ipcMain.handle('recording:get-webview-preload-path', () =>
    join(__dirname, '../preload/webview-preload.js'),
  )

  // DOM events are relayed from renderer (which listens on the <webview> ipc-message event)
  ipcMain.on('dom-event-relay', (_event, data) => {
    if (currentSession && isLeonardoEvent(data)) {
      handleDOMEvent(currentSession.webContentsId, data)
    }
  })
}
