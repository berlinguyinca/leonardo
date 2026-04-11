import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

/**
 * Resolves the FFmpeg binary path. Checks:
 * 1. Bundled binary in resources/ (production)
 * 2. System-installed ffmpeg (development)
 */
export function getFFmpegPath(): string {
  // Check bundled binary (electron-builder extracts to process.resourcesPath)
  if (process.resourcesPath) {
    const platform = process.platform
    const ext = platform === 'win32' ? '.exe' : ''
    const bundledPath = join(process.resourcesPath, 'ffmpeg', `ffmpeg${ext}`)
    if (existsSync(bundledPath)) {
      return bundledPath
    }
  }

  // Fallback to system ffmpeg
  return 'ffmpeg'
}

export function getFFprobePath(): string {
  if (process.resourcesPath) {
    const platform = process.platform
    const ext = platform === 'win32' ? '.exe' : ''
    const bundledPath = join(process.resourcesPath, 'ffmpeg', `ffprobe${ext}`)
    if (existsSync(bundledPath)) {
      return bundledPath
    }
  }

  return 'ffprobe'
}

function runFFmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: 'ignore' })
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))))
    proc.on('error', reject)
  })
}

export async function extractThumbnails(
  videoPath: string,
  outputDir: string,
  count: number,
  durationMs: number,
): Promise<string[]> {
  if (durationMs <= 0) return []
  const thumbDir = join(outputDir, 'thumbs')
  mkdirSync(thumbDir, { recursive: true })
  const ffmpegPath = getFFmpegPath()
  const paths: string[] = []

  for (let i = 0; i < count; i++) {
    const thumbPath = join(thumbDir, `thumb_${i}.jpg`)
    paths.push(thumbPath)
    if (existsSync(thumbPath)) continue
    const seekSec = ((durationMs / 1000) * i) / Math.max(count - 1, 1)
    await runFFmpeg(ffmpegPath, [
      '-ss', String(seekSec),
      '-i', videoPath,
      '-vframes', '1',
      '-vf', 'scale=120:-1',
      '-q:v', '5',
      '-y', thumbPath,
    ])
  }
  return paths.map((p) => `file://${p}`)
}
