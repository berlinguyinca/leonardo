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
      },
    },
  }
  Object.defineProperty(global, 'window', {
    value: { ...global.window, ...mock },
    writable: true,
    configurable: true,
  })
  return mock
}

describe('post-recording Edit Now prompt (integration)', () => {
  let windowMock: ReturnType<typeof setupWindowMock>

  beforeEach(() => {
    vi.useFakeTimers()

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
  })

  async function triggerStop(webviewRef: React.RefObject<Electron.WebviewTag | null>) {
    // Move to recording state first
    useRecordingStore.setState({ status: 'recording' })

    // Render and click stop
    const { container } = render(<RecordingControls webviewRef={webviewRef} />)
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
    useRecordingStore.setState({ status: 'recording' })

    render(<RecordingControls webviewRef={webviewRef} />)
    const stopBtn = screen.getByText('Stop')

    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(screen.queryByText('Clip added to library.')).toBeNull()
  })
})
