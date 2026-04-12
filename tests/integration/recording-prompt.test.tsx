// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useRecordingStore } from '@renderer/stores/recording-store'
import { useLibraryStore } from '@renderer/stores/library-store'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { RecordingControls } from '@renderer/components/browser/RecordingControls'
import React from 'react'

function makeWebviewRef(): React.RefObject<Electron.WebviewTag | null> {
  return {
    current: { getWebContentsId: () => 42 } as unknown as Electron.WebviewTag,
  } as React.RefObject<Electron.WebviewTag | null>
}

const defaultStopResult = {
  success: true,
  recordingId: 'rec-abc-123',
  videoPath: '/tmp/recordings/rec-abc-123/rec-abc-123.mp4',
  outputDir: '/tmp/recordings/rec-abc-123',
  duration: 5000,
}

function setupWindowMock(stopResult = defaultStopResult) {
  ;(window as Record<string, unknown>)['leonardo'] = {
    recording: {
      start: vi.fn().mockResolvedValue({ success: true, recordingId: 'rec-abc-123' }),
      stop: vi.fn().mockResolvedValue(stopResult),
      pause: vi.fn().mockResolvedValue({ success: true }),
      resume: vi.fn().mockResolvedValue({ success: true }),
      relayDomEvent: vi.fn(),
      getWebviewPreloadPath: vi.fn().mockResolvedValue('/path/to/webview-preload.js'),
      getStatus: vi.fn().mockResolvedValue({ isRecording: false, recordingId: null, status: 'idle', duration: 0 }),
    },
    clip: {
      create: vi.fn().mockImplementation((clip: unknown) => Promise.resolve(clip)),
    },
  }
}

describe('post-recording Edit Now prompt (integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setupWindowMock()

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
    delete (window as Record<string, unknown>)['leonardo']
  })

  async function triggerStop(webviewRef: React.RefObject<Electron.WebviewTag | null>) {
    useRecordingStore.setState({ status: 'idle' })
    const { container } = render(<RecordingControls webviewRef={webviewRef} />)

    // Click Record
    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
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

    const addClipToTimelineSpy = vi.fn()
    useTimelineStore.setState({ addClipToTimeline: addClipToTimelineSpy })

    await triggerStop(webviewRef)

    const editBtn = screen.getByText('Edit Now')
    act(() => {
      fireEvent.click(editBtn)
    })

    expect(addClipToTimelineSpy).toHaveBeenCalledOnce()
    expect(addClipToTimelineSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rec-abc-123' }),
    )

    expect(screen.queryByText('Clip added to library.')).toBeNull()
    expect(screen.queryByText('Edit Now')).toBeNull()
  })

  it('"Later" clears the prompt without calling addClipToTimeline', async () => {
    const webviewRef = makeWebviewRef()

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

    expect(screen.getByText('Clip added to library.')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(6000)
    })

    expect(screen.queryByText('Clip added to library.')).toBeNull()
  })

  it('prompt does not auto-dismiss before 6 seconds', async () => {
    const webviewRef = makeWebviewRef()
    await triggerStop(webviewRef)

    act(() => {
      vi.advanceTimersByTime(5999)
    })

    expect(screen.getByText('Clip added to library.')).toBeDefined()
  })

  it('does not show prompt when stop result is not successful', async () => {
    setupWindowMock({ success: false, recordingId: '', videoPath: '', outputDir: '', duration: 0 })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })

    render(<RecordingControls webviewRef={webviewRef} />)

    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
    })

    const stopBtn = screen.getByText('Stop')
    await act(async () => {
      fireEvent.click(stopBtn)
    })

    expect(screen.queryByText('Clip added to library.')).toBeNull()
  })
})
