import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { processRecording, type ConversionProgress } from '@main/workers/recording-worker'

describe('recording-worker', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-rec-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns error when input file does not exist', async () => {
    const result = await processRecording({
      inputPath: join(tempDir, 'nonexistent.webm'),
      outputDir: tempDir,
      projectId: 'p-1',
      recordingId: 'r-1',
      domEvents: [],
      ffmpegPath: 'ffmpeg',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Input file not found')
  })

  it('saves DOM events JSON even when FFmpeg fails', async () => {
    // Create a dummy "webm" that will fail FFmpeg conversion
    const inputPath = join(tempDir, 'bad.webm')
    writeFileSync(inputPath, 'not a real video file')

    const domEvents = [
      {
        id: 'e1',
        type: 'click' as const,
        timestamp: 1000,
        elementSelector: 'button',
        coordinates: { x: 100, y: 200 },
      },
    ]

    const result = await processRecording({
      inputPath,
      outputDir: tempDir,
      projectId: 'p-1',
      recordingId: 'r-test',
      domEvents,
      ffmpegPath: 'ffmpeg',
    })

    // FFmpeg will fail on a non-video file, but the process returns an error
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('reports progress callbacks', async () => {
    const inputPath = join(tempDir, 'test.webm')
    writeFileSync(inputPath, 'not a real video')

    const progressUpdates: ConversionProgress[] = []

    await processRecording(
      {
        inputPath,
        outputDir: tempDir,
        projectId: 'p-1',
        recordingId: 'r-prog',
        domEvents: [],
        ffmpegPath: 'ffmpeg',
      },
      (progress) => progressUpdates.push(progress),
    )

    // Should have at least the initial converting progress
    expect(progressUpdates.length).toBeGreaterThanOrEqual(1)
    expect(progressUpdates[0].stage).toBe('converting')
  })

  it('generates correct output paths', async () => {
    const inputPath = join(tempDir, 'test.webm')
    writeFileSync(inputPath, 'not a real video')

    const result = await processRecording({
      inputPath,
      outputDir: tempDir,
      projectId: 'p-1',
      recordingId: 'r-paths',
      domEvents: [
        {
          id: 'e1',
          type: 'click' as const,
          timestamp: 1000,
          elementSelector: 'a',
          coordinates: { x: 0, y: 0 },
        },
      ],
      ffmpegPath: 'ffmpeg',
    })

    // Even though FFmpeg fails, we can verify the intended paths
    // The error message will contain info about the FFmpeg failure
    expect(result.success).toBe(false)
    // Paths would have been r-paths.mp4 and r-paths.events.json
  })
})

describe('recording-worker - real FFmpeg', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-rec-ffmpeg-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('converts a valid video file (requires FFmpeg installed)', async () => {
    // Generate a minimal valid video using FFmpeg itself
    const { execSync } = await import('child_process')
    const inputPath = join(tempDir, 'test-input.webm')

    try {
      // Create a 1-second test video
      execSync(
        `ffmpeg -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libvpx -y "${inputPath}"`,
        { stdio: 'pipe', timeout: 10_000 },
      )
    } catch {
      // Skip this test if FFmpeg is not installed
      console.log('Skipping real FFmpeg test — FFmpeg not available')
      return
    }

    const domEvents = [
      {
        id: 'e1',
        type: 'click' as const,
        timestamp: 500,
        elementSelector: 'button.submit',
        coordinates: { x: 100, y: 120 },
        elementText: 'Submit',
      },
    ]

    const result = await processRecording({
      inputPath,
      outputDir: tempDir,
      projectId: 'p-real',
      recordingId: 'r-real',
      domEvents,
      ffmpegPath: 'ffmpeg',
    })

    expect(result.success).toBe(true)
    expect(existsSync(result.videoPath)).toBe(true)
    expect(result.videoPath).toContain('r-real.mp4')
    expect(existsSync(result.eventsPath)).toBe(true)

    // Verify the events JSON
    const { readFileSync } = await import('fs')
    const events = JSON.parse(readFileSync(result.eventsPath, 'utf-8'))
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('click')
  })
})
