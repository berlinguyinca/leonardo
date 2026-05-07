// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// ---- Mock electron before any imports ----
vi.mock('electron', () => ({
  webContents: {
    fromId: vi.fn(),
  },
}))

// ---- Mock ffmpeg util ----
vi.mock('@main/utils/ffmpeg', () => ({
  getFFmpegPath: vi.fn(() => '/usr/bin/ffmpeg'),
}))

// ---- Mock child_process.spawn ----
const mockStdin = {
  write: vi.fn(),
  end: vi.fn(),
  destroyed: false,
}

function makeMockFFmpeg() {
  const emitter = new EventEmitter() as EventEmitter & {
    stdin: typeof mockStdin
  }
  emitter.stdin = { ...mockStdin, destroyed: false }
  return emitter
}

let mockFFmpegInstance: ReturnType<typeof makeMockFFmpeg>

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockFFmpegInstance),
}))

import { webContents } from 'electron'
import {
  startFrameCapture,
  pauseFrameCapture,
  resumeFrameCapture,
  stopFrameCapture,
  isCapturing,
} from '@main/services/frame-capture'

const mockedWebContents = webContents as unknown as { fromId: ReturnType<typeof vi.fn> }

function makeMockWebContents() {
  return {
    capturePage: vi.fn().mockResolvedValue({
      toJPEG: vi.fn(() => Buffer.from('fake-jpeg')),
    }),
  }
}

describe('frame-capture service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFFmpegInstance = makeMockFFmpeg()
    mockedWebContents.fromId.mockReturnValue(makeMockWebContents())
  })

  afterEach(async () => {
    // Clean up active session if left over
    if (isCapturing()) {
      const p = stopFrameCapture()
      mockFFmpegInstance.emit('close', 0)
      await p
    }
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('startFrameCapture starts capturing (isCapturing becomes true)', () => {
    expect(isCapturing()).toBe(false)
    startFrameCapture(1, '/tmp/out.mp4')
    expect(isCapturing()).toBe(true)
  })

  it('startFrameCapture throws when already capturing', () => {
    startFrameCapture(1, '/tmp/out.mp4')
    expect(() => startFrameCapture(2, '/tmp/out2.mp4')).toThrow('Frame capture already in progress')
  })

  it('pauseFrameCapture is safe when not capturing (no throw)', () => {
    expect(isCapturing()).toBe(false)
    expect(() => pauseFrameCapture()).not.toThrow()
  })

  it('pauseFrameCapture stops the interval while capturing', () => {
    startFrameCapture(1, '/tmp/out.mp4')
    expect(isCapturing()).toBe(true)
    pauseFrameCapture()
    // still "capturing" (session exists) but interval is cleared
    expect(isCapturing()).toBe(true)
  })

  it('resumeFrameCapture restarts after pause', () => {
    startFrameCapture(1, '/tmp/out.mp4')
    pauseFrameCapture()
    // Should not throw — restarts interval
    expect(() => resumeFrameCapture()).not.toThrow()
    expect(isCapturing()).toBe(true)
  })

  it('stopFrameCapture resolves with output path when ffmpeg exits cleanly', async () => {
    startFrameCapture(1, '/tmp/out.mp4')
    const promise = stopFrameCapture()
    mockFFmpegInstance.emit('close', 0)
    const result = await promise
    expect(result).toBe('/tmp/out.mp4')
    expect(isCapturing()).toBe(false)
  })

  it('stopFrameCapture rejects when ffmpeg exits with non-zero code', async () => {
    startFrameCapture(1, '/tmp/out.mp4')
    const promise = stopFrameCapture()
    mockFFmpegInstance.emit('close', 1)
    await expect(promise).rejects.toThrow('FFmpeg exited with code 1')
  })

  it('stopFrameCapture throws when not capturing', async () => {
    await expect(stopFrameCapture()).rejects.toThrow('No frame capture in progress')
  })

  it('isCapturing returns correct state through lifecycle', async () => {
    expect(isCapturing()).toBe(false)

    startFrameCapture(1, '/tmp/out.mp4')
    expect(isCapturing()).toBe(true)

    const promise = stopFrameCapture()
    // After stop is initiated, isCapturing is already false
    expect(isCapturing()).toBe(false)

    mockFFmpegInstance.emit('close', 0)
    await promise
    expect(isCapturing()).toBe(false)
  })
})
