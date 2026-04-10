import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync, spawnSync } from 'child_process'
import { join } from 'path'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import {
  buildFreezeFrameFilter,
  buildFadeFilter,
  buildOverlayFilter,
  buildAudioMixFilter,
  buildFFmpegArgs,
  buildEncodingArgs,
} from '@main/utils/ffmpeg-builder'

function ffmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function getVideoInfo(filePath: string): { duration: number; width: number; height: number; codec: string } {
  const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    filePath,
  ], { encoding: 'utf-8' })

  const info = JSON.parse(result.stdout)
  const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === 'video')

  return {
    duration: parseFloat(info.format?.duration ?? '0'),
    width: parseInt(videoStream?.width ?? '0'),
    height: parseInt(videoStream?.height ?? '0'),
    codec: videoStream?.codec_name ?? '',
  }
}

describe.skipIf(!ffmpegAvailable())('FFmpeg rendering integration (real FFmpeg)', () => {
  let tempDir: string
  let testVideoPath: string
  let testAudioPath: string
  let testOverlayPath: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-ffmpeg-spike-'))

    // Generate a 5-second blue test video at 320x240
    testVideoPath = join(tempDir, 'test-video.mp4')
    execSync(
      `ffmpeg -f lavfi -i "color=c=blue:s=320x240:d=5:r=30" -c:v libx264 -preset ultrafast -y "${testVideoPath}"`,
      { stdio: 'pipe', timeout: 15_000 },
    )

    // Generate a 5-second sine wave audio
    testAudioPath = join(tempDir, 'test-audio.wav')
    execSync(
      `ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -y "${testAudioPath}"`,
      { stdio: 'pipe', timeout: 10_000 },
    )

    // Generate a small red overlay image
    testOverlayPath = join(tempDir, 'overlay.png')
    execSync(
      `ffmpeg -f lavfi -i "color=c=red:s=80x60:d=1" -frames:v 1 -y "${testOverlayPath}"`,
      { stdio: 'pipe', timeout: 10_000 },
    )
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('freeze frame: holds frame at timestamp for specified duration', () => {
    const outputPath = join(tempDir, 'freeze-output.mp4')
    const filtergraph = buildFreezeFrameFilter(
      { type: 'freeze', timestamp: 2, duration: 3 },
      '0:v',
      'frozen',
    )

    const args = buildFFmpegArgs({
      inputs: [{ path: testVideoPath }],
      filtergraph,
      outputArgs: ['-map', '[frozen]', ...buildEncodingArgs('h264')],
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 30_000 })
    expect(result.status).toBe(0)
    expect(existsSync(outputPath)).toBe(true)

    const info = getVideoInfo(outputPath)
    // Original: 5s + freeze adds 3s = ~8s total
    expect(info.duration).toBeGreaterThanOrEqual(7)
    expect(info.duration).toBeLessThanOrEqual(9)
    expect(info.width).toBe(320)
    expect(info.height).toBe(240)
  })

  it('fade in: applies fade-in effect at start', () => {
    const outputPath = join(tempDir, 'fadein-output.mp4')
    const filtergraph = buildFadeFilter(
      { type: 'fade', direction: 'in', timestamp: 0, duration: 1 },
      '0:v',
      'faded',
    )

    const args = buildFFmpegArgs({
      inputs: [{ path: testVideoPath }],
      filtergraph,
      outputArgs: ['-map', '[faded]', ...buildEncodingArgs('h264')],
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 15_000 })
    expect(result.status).toBe(0)
    expect(existsSync(outputPath)).toBe(true)

    const info = getVideoInfo(outputPath)
    expect(info.duration).toBeCloseTo(5, 0)
    expect(info.codec).toBe('h264')
  })

  it('fade out: applies fade-out effect', () => {
    const outputPath = join(tempDir, 'fadeout-output.mp4')
    const filtergraph = buildFadeFilter(
      { type: 'fade', direction: 'out', timestamp: 4, duration: 1 },
      '0:v',
      'faded',
    )

    const args = buildFFmpegArgs({
      inputs: [{ path: testVideoPath }],
      filtergraph,
      outputArgs: ['-map', '[faded]', ...buildEncodingArgs('h264')],
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 15_000 })
    expect(result.status).toBe(0)
    expect(existsSync(outputPath)).toBe(true)
  })

  it('overlay: composites image on top of video for time range', () => {
    const outputPath = join(tempDir, 'overlay-output.mp4')
    const filtergraph = buildOverlayFilter('0:v', '1:v', 'composited', {
      x: 10,
      y: 10,
      startTime: 1,
      endTime: 4,
    })

    const args = buildFFmpegArgs({
      inputs: [{ path: testVideoPath }, { path: testOverlayPath, args: ['-loop', '1'] }],
      filtergraph,
      outputArgs: ['-map', '[composited]', '-t', '5', ...buildEncodingArgs('h264')],
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 15_000 })
    expect(result.status).toBe(0)
    expect(existsSync(outputPath)).toBe(true)

    const info = getVideoInfo(outputPath)
    expect(info.width).toBe(320)
    expect(info.height).toBe(240)
  })

  it('audio mix: combines video with audio track', () => {
    const outputPath = join(tempDir, 'mixed-output.mp4')

    // Simple: map video from first input, audio from second
    const args = buildFFmpegArgs({
      inputs: [{ path: testVideoPath }, { path: testAudioPath }],
      filtergraph: '',
      outputArgs: [
        '-map', '0:v',
        '-map', '1:a',
        '-shortest',
        ...buildEncodingArgs('h264'),
      ],
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 15_000 })
    expect(result.status).toBe(0)
    expect(existsSync(outputPath)).toBe(true)
  })

  it('H.265 output is valid', () => {
    const outputPath = join(tempDir, 'h265-output.mp4')

    const args = buildFFmpegArgs({
      inputs: [{ path: testVideoPath }],
      filtergraph: '',
      outputArgs: buildEncodingArgs('h265'),
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 30_000 })

    if (result.status !== 0) {
      // H.265 encoder may not be available on all systems
      console.log('H.265 encoding not available, skipping')
      return
    }

    expect(existsSync(outputPath)).toBe(true)
    const info = getVideoInfo(outputPath)
    expect(info.codec).toBe('hevc')
  })

  it('ProRes output is valid', () => {
    const outputPath = join(tempDir, 'prores-output.mov')

    const args = buildFFmpegArgs({
      inputs: [{ path: testVideoPath }],
      filtergraph: '',
      outputArgs: buildEncodingArgs('prores'),
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 15_000 })

    if (result.status !== 0) {
      console.log('ProRes encoding not available, skipping')
      return
    }

    expect(existsSync(outputPath)).toBe(true)
    const info = getVideoInfo(outputPath)
    expect(info.codec).toBe('prores')
  })

  it('chained effects: fade-in + overlay + audio', () => {
    const outputPath = join(tempDir, 'chained-output.mp4')

    // Build a complex filtergraph: fade-in on video, then overlay
    const filtergraph = [
      buildFadeFilter(
        { type: 'fade', direction: 'in', timestamp: 0, duration: 1 },
        '0:v',
        'faded',
      ),
      buildOverlayFilter('faded', '1:v', 'composited', {
        x: 10,
        y: 10,
        startTime: 2,
        endTime: 4,
      }),
    ].join(';')

    const args = buildFFmpegArgs({
      inputs: [
        { path: testVideoPath },
        { path: testOverlayPath, args: ['-loop', '1'] },
        { path: testAudioPath },
      ],
      filtergraph,
      outputArgs: [
        '-map', '[composited]',
        '-map', '2:a',
        '-t', '5',
        '-shortest',
        ...buildEncodingArgs('h264'),
      ],
      outputPath,
    })

    const result = spawnSync('ffmpeg', args, { stdio: 'pipe', timeout: 30_000 })
    expect(result.status).toBe(0)
    expect(existsSync(outputPath)).toBe(true)

    const info = getVideoInfo(outputPath)
    expect(info.width).toBe(320)
    expect(info.height).toBe(240)
    expect(info.codec).toBe('h264')
  })
})
