// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useRecordingStore } from '@renderer/stores/recording-store'
import { useLibraryStore } from '@renderer/stores/library-store'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { RecordingControls } from '@renderer/components/browser/RecordingControls'
import React from 'react'

// Minimal webview ref mock
function makeWebviewRef(): React.RefObject<Electron.WebviewTag | null> {
  return { current: null } as React.RefObject<Electron.WebviewTag | null>
}

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

function makeMockStream(): MediaStream {
  const track = { stop: vi.fn(), kind: 'video' } as unknown as MediaStreamTrack
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream
}

// Default mock stop result
const defaultStopResult = {
  success: true,
  recordingId: 'rec-abc-123',
  outputDir: '/tmp/recordings/rec-abc-123',
  duration: 5000,
}

function setupWindowMock(stopResult = defaultStopResult) {
  const mock = {
    leonardo: {
      recording: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(stopResult),
        pause: vi.fn(),
        resume: vi.fn(),
        saveBlob: vi.fn().mockResolvedValue({
          success: true,
          webmPath: `${stopResult.outputDir ?? '/tmp/recordings'}/recording.webm`,
        }),
        convert: vi.fn().mockResolvedValue({
          success: true,
          videoPath: `${stopResult.outputDir ?? '/tmp/recordings'}/recording.mp4`,
          eventsPath: `${stopResult.outputDir ?? '/tmp/recordings'}/recording.events.json`,
        }),
        relayDomEvent: vi.fn(),
        getWebviewPreloadPath: vi.fn().mockResolvedValue('/path/to/webview-preload.js'),
      },
    },
  }
  ;(window as Record<string, unknown>)['leonardo'] = mock.leonardo
  return mock
}

describe('post-recording Edit Now prompt (integration)', () => {
  let windowMock: ReturnType<typeof setupWindowMock>

  beforeEach(() => {
    vi.useFakeTimers()

    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(makeMockStream()),
      },
    })

    windowMock = setupWindowMock()

    useRecordingStore.setState({
      status: 'idle',
      currentUrl: 'https://example.com',
      recordingDuration: 5000,
      targetResolution: { width: 1920, height: 1080 },
    })

    useLibraryStore.setState({
      clips: [],
      highlightedClipId: null,
    })

    // Reset timeline store — temporal store needs careful reset
    useTimelineStore.setState({
      timeline: {
        id: 'tl-1',
        projectId: 'proj-1',
        tracks: [],
        syncPoints: [],
        duration: 0,
        reviewed: false,
      },
      playheadPosition: 0,
      zoomLevel: 1,
      selectedSyncPointId: null,
      selectedSegmentId: null,
      isPlaying: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  async function triggerStop(webviewRef: React.RefObject<Electron.WebviewTag | null>) {
    useRecordingStore.setState({ status: 'idle' })
    const { container } = render(<RecordingControls webviewRef={webviewRef} />)

    // Click Record to initialize the MediaRecorder
    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
    })
    // Advance past the MediaRecorder timeslice (1000ms) so a data chunk is captured
    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    // Click Stop
    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })
    return container
  }

  it('shows prompt with correct text and buttons after stop', async () => {
    const webviewRef = makeWebviewRef()
    await triggerStop(webviewRef)

    expect(screen.getByText('Clip added to library.')).toBeDefined()
    expect(screen.getByText('Edit Now')).toBeDefined()
    expect(screen.getByText('Later')).toBeDefined()
  })

  it('prompt is inside .post-recording-prompt container', async () => {
    const webviewRef = makeWebviewRef()
    const container = await triggerStop(webviewRef)

    const prompt = container.querySelector('.post-recording-prompt')
    expect(prompt).not.toBeNull()
  })

  it('"Edit Now" calls addClipToTimeline and clears the prompt', async () => {
    const webviewRef = makeWebviewRef()

    // Spy before rendering so the store state is patched before the component mounts
    const addClipToTimelineSpy = vi.fn()
    useTimelineStore.setState({ addClipToTimeline: addClipToTimelineSpy })

    await triggerStop(webviewRef)

    const editBtn = screen.getByText('Edit Now')
    act(() => {
      fireEvent.click(editBtn)
    })

    expect(addClipToTimelineSpy).toHaveBeenCalledOnce()
    // The clip passed should have the recordingId as its id
    expect(addClipToTimelineSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rec-abc-123' }),
    )

    // Prompt should be gone
    expect(screen.queryByText('Clip added to library.')).toBeNull()
    expect(screen.queryByText('Edit Now')).toBeNull()
  })

  it('"Later" clears the prompt without calling addClipToTimeline', async () => {
    const webviewRef = makeWebviewRef()

    // Spy before rendering
    const addClipToTimelineSpy = vi.fn()
    useTimelineStore.setState({ addClipToTimeline: addClipToTimelineSpy })

    await triggerStop(webviewRef)

    const laterBtn = screen.getByText('Later')
    act(() => {
      fireEvent.click(laterBtn)
    })

    expect(addClipToTimelineSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('Clip added to library.')).toBeNull()
    expect(screen.queryByText('Later')).toBeNull()
  })

  it('prompt auto-dismisses after 6 seconds', async () => {
    const webviewRef = makeWebviewRef()
    await triggerStop(webviewRef)

    // Verify prompt is visible
    expect(screen.getByText('Clip added to library.')).toBeDefined()

    // Advance time by 6 seconds
    act(() => {
      vi.advanceTimersByTime(6000)
    })

    expect(screen.queryByText('Clip added to library.')).toBeNull()
  })

  it('prompt does not auto-dismiss before 6 seconds', async () => {
    const webviewRef = makeWebviewRef()
    await triggerStop(webviewRef)

    // Advance to just under 6 seconds
    act(() => {
      vi.advanceTimersByTime(5999)
    })

    expect(screen.getByText('Clip added to library.')).toBeDefined()
  })

  it('does not show prompt when stop result is not successful', async () => {
    setupWindowMock({ success: false, recordingId: '', outputDir: '', duration: 0 })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })

    render(<RecordingControls webviewRef={webviewRef} />)

    // Click Record to initialize the MediaRecorder
    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
    })
    // Advance past the MediaRecorder timeslice so a data chunk is captured
    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(screen.queryByText('Clip added to library.')).toBeNull()
  })
})
