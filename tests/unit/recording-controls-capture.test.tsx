// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useRecordingStore } from '@renderer/stores/recording-store'
import { useLibraryStore } from '@renderer/stores/library-store'
import { useProjectStore } from '@renderer/stores/project-store'
import { RecordingControls } from '@renderer/components/browser/RecordingControls'
import React from 'react'

function makeWebviewRef(id = 42): React.RefObject<Electron.WebviewTag | null> {
  return {
    current: { getWebContentsId: () => id } as unknown as Electron.WebviewTag,
  } as React.RefObject<Electron.WebviewTag | null>
}

type RecordingBridge = {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  relayDomEvent: ReturnType<typeof vi.fn>
  getWebviewPreloadPath: ReturnType<typeof vi.fn>
}

function setupWindowMock(stopOverride?: Partial<{ success: boolean; recordingId: string; videoPath: string; duration: number }>): RecordingBridge {
  const recording: RecordingBridge = {
    start: vi.fn().mockResolvedValue({ success: true, recordingId: 'rec-123', outputDir: '/tmp/rec-123' }),
    stop: vi.fn().mockResolvedValue({
      success: true,
      recordingId: 'rec-123',
      videoPath: '/tmp/rec-123/recording.mp4',
      duration: 5000,
      ...stopOverride,
    }),
    pause: vi.fn().mockResolvedValue({ success: true }),
    resume: vi.fn().mockResolvedValue({ success: true }),
    relayDomEvent: vi.fn(),
    getWebviewPreloadPath: vi.fn().mockResolvedValue('/path/to/webview-preload.js'),
  }

  ;(window as Record<string, unknown>).leonardo = {
    recording,
    clip: {
      create: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
      export: vi.fn().mockResolvedValue({ success: true }),
      getEvents: vi.fn().mockResolvedValue([]),
      getThumbnails: vi.fn().mockResolvedValue([]),
    },
  }

  return recording
}

describe('RecordingControls — new IPC recording flow (unit)', () => {
  let recording: RecordingBridge

  beforeEach(() => {
    vi.useFakeTimers()

    recording = setupWindowMock()

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

    useProjectStore.setState({
      activeProjectId: null,
      projects: [],
      loading: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // --- start ---

  it('calls window.leonardo.recording.start with webviewId when Record is clicked', async () => {
    const webviewRef = makeWebviewRef(42)
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    const recordBtn = screen.getByText('Record')
    await act(async () => {
      fireEvent.click(recordBtn)
    })

    expect(recording.start).toHaveBeenCalledWith(
      expect.objectContaining({ webviewId: 42 }),
    )
  })

  it('passes activeProjectId to recording.start when a project is active', async () => {
    useProjectStore.setState({ activeProjectId: 'proj-abc', projects: [], loading: false })
    const webviewRef = makeWebviewRef(7)
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Record'))
    })

    expect(recording.start).toHaveBeenCalledWith(
      expect.objectContaining({ webviewId: 7, projectId: 'proj-abc' }),
    )
  })

  it('does NOT call start and stays idle when webviewRef.current is null', async () => {
    const nullRef = { current: null } as React.RefObject<Electron.WebviewTag | null>
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={nullRef} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Record'))
    })

    expect(recording.start).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().status).toBe('idle')
  })

  it('sets status to recording after clicking Record (with valid webview)', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Record'))
    })

    // Timer is ticking — status should be recording
    expect(useRecordingStore.getState().status).toBe('recording')
  })

  // --- stop ---

  it('calls window.leonardo.recording.stop when Stop is clicked', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    // Start recording
    await act(async () => { fireEvent.click(screen.getByText('Record')) })

    // Stop recording
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(recording.stop).toHaveBeenCalled()
  })

  it('creates a clip with videoPath and recordingId from stop result', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    const clips = useLibraryStore.getState().clips
    expect(clips).toHaveLength(1)
    expect(clips[0].id).toBe('rec-123')
    expect(clips[0].filePath).toBe('/tmp/rec-123/recording.mp4')
  })

  it('uses duration from stop result for the clip', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    const clips = useLibraryStore.getState().clips
    expect(clips[0].duration).toBe(5000)
  })

  it('shows "Clip added to library." after successful stop', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(screen.getByText('Clip added to library.')).toBeDefined()
  })

  it('returns to idle status after successful stop', async () => {
    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(useRecordingStore.getState().status).toBe('idle')
  })

  // --- stop failure ---

  it('does not create a clip when stop returns success: false', async () => {
    recording.stop.mockResolvedValue({ success: false, error: 'recording failed' })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(useLibraryStore.getState().clips).toHaveLength(0)
  })

  it('does not create a clip when stop result has no videoPath', async () => {
    recording.stop.mockResolvedValue({
      success: true,
      recordingId: 'rec-123',
      videoPath: undefined,
    })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(useLibraryStore.getState().clips).toHaveLength(0)
  })

  it('does not create a clip when stop result has no recordingId', async () => {
    recording.stop.mockResolvedValue({
      success: true,
      recordingId: undefined,
      videoPath: '/tmp/rec-123/recording.mp4',
    })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(useLibraryStore.getState().clips).toHaveLength(0)
  })

  it('still returns to idle status even when stop returns success: false', async () => {
    recording.stop.mockResolvedValue({ success: false, error: 'crash' })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(useRecordingStore.getState().status).toBe('idle')
  })

  // --- no MediaRecorder / getDisplayMedia ---

  it('does not touch navigator.mediaDevices at all', async () => {
    const getSpy = vi.fn()
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getDisplayMedia: getSpy },
      configurable: true,
    })

    const webviewRef = makeWebviewRef()
    useRecordingStore.setState({ status: 'idle' })
    render(<RecordingControls webviewRef={webviewRef} />)

    await act(async () => { fireEvent.click(screen.getByText('Record')) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(getSpy).not.toHaveBeenCalled()
  })
})
