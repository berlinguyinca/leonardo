// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useRecordingStore } from '@renderer/stores/recording-store'
import { useLibraryStore } from '@renderer/stores/library-store'
import { RecordingControls } from '@renderer/components/browser/RecordingControls'
import React from 'react'

// ---- MediaRecorder mock ----
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  stream: MediaStream
  mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this.stream = stream
    this.mimeType = options?.mimeType ?? 'video/webm'
  }

  start(timeslice?: number) {
    this.state = 'recording'
    if (timeslice) {
      // Simulate one data chunk immediately
      setTimeout(() => {
        this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'video/webm' }) })
      }, timeslice)
    }
  }

  stop() {
    this.state = 'inactive'
    this.onstop?.()
  }
}

function makeWebviewRef(): React.RefObject<Electron.WebviewTag | null> {
  return { current: null } as React.RefObject<Electron.WebviewTag | null>
}

function makeMockStream(): MediaStream {
  const track = { stop: vi.fn(), kind: 'video' } as unknown as MediaStreamTrack
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream
}

function setupWindowMock(overrides: Record<string, unknown> = {}) {
  const mockStream = makeMockStream()
  vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  vi.stubGlobal('navigator', {
    ...navigator,
    mediaDevices: {
      getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
    },
  })

  const defaultRecording = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({
      success: true,
      recordingId: 'rec-test-123',
      outputDir: '/tmp/recordings/rec-test-123',
      duration: 5000,
    }),
    pause: vi.fn(),
    resume: vi.fn(),
    saveBlob: vi.fn().mockResolvedValue({
      success: true,
      webmPath: '/tmp/recordings/rec-test-123/recording.webm',
    }),
    convert: vi.fn().mockResolvedValue({
      success: true,
      videoPath: '/tmp/recordings/rec-test-123/recording.mp4',
      eventsPath: '/tmp/recordings/rec-test-123/recording.events.json',
    }),
    relayDomEvent: vi.fn(),
    getWebviewPreloadPath: vi.fn().mockResolvedValue('/path/to/webview-preload.js'),
  }

  ;(window as Record<string, unknown>)['leonardo'] = {
    recording: { ...defaultRecording, ...overrides },
  }

  return { mockStream, recording: (window as Record<string, unknown>)['leonardo'] as { recording: typeof defaultRecording } }
}

describe('RecordingControls — screen capture (unit)', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    setupWindowMock()

    useRecordingStore.setState({
      status: 'idle',
      currentUrl: 'https://example.com',
      recordingDuration: 0,
      targetResolution: { width: 1920, height: 1080 },
    })

    useLibraryStore.setState({
      clips: [],
      highlightedClipId: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls getDisplayMedia when Record is clicked', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
    })

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled()
  })

  it('calls recording.start() when Record is clicked', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
    })

    expect(window.leonardo.recording.start).toHaveBeenCalled()
  })

  async function startRecording(webviewRef: React.RefObject<Electron.WebviewTag | null>) {
    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
    })
    // Advance past the MediaRecorder timeslice (1000ms) so a data chunk is captured
    await act(async () => {
      vi.advanceTimersByTime(1100)
    })
  }

  it('calls saveBlob and convert when Stop is clicked after recording', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await startRecording(webviewRef)

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(window.leonardo.recording.stop).toHaveBeenCalled()
    expect(window.leonardo.recording.saveBlob).toHaveBeenCalledWith(
      expect.objectContaining({ outputDir: '/tmp/recordings/rec-test-123' }),
    )
    expect(window.leonardo.recording.convert).toHaveBeenCalledWith(
      expect.objectContaining({
        recordingId: 'rec-test-123',
        webmPath: '/tmp/recordings/rec-test-123/recording.webm',
        outputDir: '/tmp/recordings/rec-test-123',
      }),
    )
  })

  it('creates a clip with videoPath from convert result', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await startRecording(webviewRef)

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    const clips = useLibraryStore.getState().clips
    expect(clips).toHaveLength(1)
    expect(clips[0].filePath).toBe('/tmp/recordings/rec-test-123/recording.mp4')
    expect(clips[0].id).toBe('rec-test-123')
  })

  it('shows "Clip added to library." after successful stop', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await startRecording(webviewRef)

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(screen.getByText('Clip added to library.')).toBeDefined()
  })

  it('does not create clip when saveBlob fails', async () => {
    ;(window.leonardo.recording.saveBlob as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'disk full',
      webmPath: '',
    })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await startRecording(webviewRef)

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(window.leonardo.recording.convert).not.toHaveBeenCalled()
    expect(useLibraryStore.getState().clips).toHaveLength(0)
  })

  it('does not create clip when convert returns success=false', async () => {
    ;(window.leonardo.recording.convert as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'ffmpeg failed',
    })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await startRecording(webviewRef)

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(useLibraryStore.getState().clips).toHaveLength(0)
  })

  it('continues recording without video when getDisplayMedia is denied', async () => {
    ;(navigator.mediaDevices.getDisplayMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Permission denied'),
    )

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    const recordBtn = screen.getByText('Record')
    // Should not throw
    await act(async () => {
      fireEvent.click(recordBtn)
    })

    // Should still be in recording state
    expect(useRecordingStore.getState().status).toBe('recording')
  })

  it('does not call saveBlob when blob is empty after denied capture', async () => {
    // Deny screen share so no MediaRecorder is created — blob will be empty
    ;(navigator.mediaDevices.getDisplayMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Permission denied'),
    )

    const webviewRef = makeWebviewRef()
    // Start in recording state (as if user already clicked Record and it transitioned)
    useRecordingStore.setState({ status: 'recording' })
    render(<RecordingControls webviewRef={webviewRef} />)

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    // saveBlob should NOT be called because blob.size === 0
    expect(window.leonardo.recording.saveBlob).not.toHaveBeenCalled()
    // Status should end up idle (via finally block)
    expect(useRecordingStore.getState().status).toBe('idle')
  })
})
