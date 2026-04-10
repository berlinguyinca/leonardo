import { existsSync } from 'fs'
import { join } from 'path'

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
