import { spawn, type ChildProcess } from 'child_process'
import { webContents } from 'electron'
import { getFFmpegPath } from '../utils/ffmpeg'

const CAPTURE_FPS = 15
const CAPTURE_INTERVAL_MS = Math.round(1000 / CAPTURE_FPS)
const JPEG_QUALITY = 80

interface FrameCaptureSession {
  interval: ReturnType<typeof setInterval> | null
  ffmpeg: ChildProcess
  webContentsId: number
  outputPath: string
}

let activeSession: FrameCaptureSession | null = null

export function startFrameCapture(
  webContentsId: number,
  outputPath: string,
): void {
  if (activeSession) {
    throw new Error('Frame capture already in progress')
  }

  const ffmpegPath = getFFmpegPath()
  const ffmpeg = spawn(ffmpegPath, [
    '-f', 'image2pipe',
    '-framerate', String(CAPTURE_FPS),
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '23',
    '-movflags', '+faststart',
    '-y',
    outputPath,
  ], { stdio: ['pipe', 'ignore', 'ignore'] })

  activeSession = {
    interval: null,
    ffmpeg,
    webContentsId,
    outputPath,
  }

  startInterval()
}

function startInterval(): void {
  if (!activeSession) return
  const { webContentsId, ffmpeg } = activeSession
  const wc = webContents.fromId(webContentsId)
  if (!wc) return

  activeSession.interval = setInterval(() => {
    if (!activeSession || !ffmpeg.stdin || ffmpeg.stdin.destroyed) return
    wc.capturePage().then((image) => {
      if (!activeSession || !ffmpeg.stdin || ffmpeg.stdin.destroyed) return
      const jpeg = image.toJPEG(JPEG_QUALITY)
      if (jpeg.length > 0) {
        ffmpeg.stdin.write(jpeg)
      }
    }).catch(() => {
      // capturePage can fail if webContents is destroyed — safe to skip frame
    })
  }, CAPTURE_INTERVAL_MS)
}

export function pauseFrameCapture(): void {
  if (!activeSession) return
  if (activeSession.interval) {
    clearInterval(activeSession.interval)
    activeSession.interval = null
  }
}

export function resumeFrameCapture(): void {
  if (!activeSession) return
  startInterval()
}

export async function stopFrameCapture(): Promise<string> {
  if (!activeSession) {
    throw new Error('No frame capture in progress')
  }

  const session = activeSession
  activeSession = null

  // Stop capturing frames
  if (session.interval) {
    clearInterval(session.interval)
  }

  // Close FFmpeg stdin and wait for it to finalize the MP4
  return new Promise<string>((resolve, reject) => {
    session.ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(session.outputPath)
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
    session.ffmpeg.on('error', reject)

    if (session.ffmpeg.stdin && !session.ffmpeg.stdin.destroyed) {
      session.ffmpeg.stdin.end()
    }
  })
}

export function isCapturing(): boolean {
  return activeSession !== null
}
