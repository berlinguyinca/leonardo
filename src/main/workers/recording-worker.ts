import { spawn } from 'child_process'
import { join } from 'path'
import { writeFileSync, existsSync } from 'fs'
import type { DOMEvent } from '@shared/types/events'

export interface RecordingWorkerInput {
  inputPath: string
  outputDir: string
  projectId: string
  recordingId: string
  domEvents: DOMEvent[]
  ffmpegPath: string
}

export interface RecordingWorkerOutput {
  success: boolean
  videoPath: string
  eventsPath: string
  error?: string
}

export interface ConversionProgress {
  stage: 'converting' | 'saving-events' | 'complete'
  percent: number
}

/**
 * Converts a WebM recording to H.264 MP4 and saves the DOM events JSON alongside it.
 * Designed to run as an isolated operation — can be called from a child_process or directly.
 */
export async function processRecording(
  input: RecordingWorkerInput,
  onProgress?: (progress: ConversionProgress) => void,
): Promise<RecordingWorkerOutput> {
  const videoFileName = `${input.recordingId}.mp4`
  const eventsFileName = `${input.recordingId}.events.json`
  const videoPath = join(input.outputDir, videoFileName)
  const eventsPath = join(input.outputDir, eventsFileName)

  try {
    // Stage 1: Convert WebM to H.264 MP4
    onProgress?.({ stage: 'converting', percent: 0 })

    await convertWebMToMP4(input.inputPath, videoPath, input.ffmpegPath, (percent) => {
      onProgress?.({ stage: 'converting', percent })
    })

    // Stage 2: Save DOM events JSON
    onProgress?.({ stage: 'saving-events', percent: 90 })
    writeFileSync(eventsPath, JSON.stringify(input.domEvents, null, 2))

    onProgress?.({ stage: 'complete', percent: 100 })

    return { success: true, videoPath, eventsPath }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return { success: false, videoPath: '', eventsPath: '', error: errorMessage }
  }
}

function convertWebMToMP4(
  inputPath: string,
  outputPath: string,
  ffmpegPath: string,
  onPercent: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!existsSync(inputPath)) {
      reject(new Error(`Input file not found: ${inputPath}`))
      return
    }

    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath,
    ]

    const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stderrData = ''

    proc.stderr?.on('data', (data: Buffer) => {
      stderrData += data.toString()
      // Parse FFmpeg progress from stderr (duration/time lines)
      const timeMatch = stderrData.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
      if (timeMatch) {
        // Basic progress estimation — exact requires knowing total duration
        onPercent(50) // Placeholder: real implementation parses Duration header
      }
    })

    proc.on('close', (code) => {
      if (code === 0) {
        onPercent(85)
        resolve()
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderrData.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg process error: ${err.message}`))
    })
  })
}
