import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS } from '@shared/constants'
import { startCapture, stopCapture, handleDOMEvent, isLeonardoEvent } from '../services/dom-capture'
import { processRecording } from '../workers/recording-worker'
import { getFFmpegPath } from '../utils/ffmpeg'

interface RecordingSession {
  id: string
  projectId: string
  webContentsId: number
  status: 'recording' | 'paused' | 'stopped'
  startTime: number
  outputDir: string
}

let currentSession: RecordingSession | null = null

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

      // Set up message forwarding from webview for DOM events
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        mainWindow.webContents.on('ipc-message', (_event, channel, ...args) => {
          if (channel === 'dom-event' && currentSession) {
            const data = args[0]
            if (isLeonardoEvent(data)) {
              handleDOMEvent(currentSession.webContentsId, data)
            }
          }
        })
      }

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
      const domEvents = stopCapture(-1) // Already stopped, but safe

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
}
