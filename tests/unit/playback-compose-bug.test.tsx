// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import { playheadEmitter } from '../../src/renderer/hooks/PlayheadEmitter'
import type { SyncTimeline, Segment, Clip } from '@shared/types'

// --- Helpers ---

function makeSegment(overrides?: Partial<Segment>): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/path/to/video-a.mp4',
    sourceOffset: 0,
    label: 'Clip A',
    ...overrides,
  }
}

function makeTwoSegmentTimeline(): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [
      {
        id: 'track-1',
        type: 'clip',
        segments: [
          makeSegment({ id: 'seg-1', startTime: 0, endTime: 5000, sourceFile: '/video-a.mp4' }),
          makeSegment({ id: 'seg-2', startTime: 5000, endTime: 10000, sourceFile: '/video-b.mp4' }),
        ],
        zOrder: 0,
        label: 'Video',
        muted: false,
        locked: false,
      },
    ],
    syncPoints: [],
    duration: 10000,
    reviewed: false,
  }
}

function makeClips(): Clip[] {
  return [
    {
      id: 'clip-a',
      projectId: 'p-1',
      filePath: '/video-a.mp4',
      duration: 5000,
      url: 'https://example.com',
      resolution: { width: 1920, height: 1080 },
      createdAt: '2026-04-11T10:00:00Z',
      label: 'Clip A',
    },
    {
      id: 'clip-b',
      projectId: 'p-1',
      filePath: '/video-b.mp4',
      duration: 5000,
      url: 'https://example.com',
      resolution: { width: 1920, height: 1080 },
      createdAt: '2026-04-11T10:00:00Z',
      label: 'Clip B',
    },
  ]
}

// Stub HTMLMediaElement methods for jsdom
let playSpy: ReturnType<typeof vi.spyOn>
let pauseSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  ;(window as Record<string, unknown>).leonardo = { clip: { getThumbnails: async () => [] } }
})

afterEach(() => {
  vi.restoreAllMocks()
  playheadEmitter.all.clear()
})

// --- Lazy imports (after mocks) ---

import { VideoPlayer } from '../../src/renderer/components/preview/VideoPlayer'
import { PlaybackPanel } from '../../src/renderer/components/preview/PlaybackPanel'
import { TransportControls } from '../../src/renderer/components/timeline/TransportControls'

// =============================================================================
// Test 1: VideoPlayer re-plays on src change
// =============================================================================

describe('VideoPlayer — src change re-triggers play()', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: null,
      playheadPosition: 0,
      isPlaying: false,
      playbackRate: 1,
    })
  })

  it('calls video.play() again when src changes while playing', () => {
    const { container, rerender } = render(
      <VideoPlayer src="media:///video-a.mp4" currentTime={0} playing={true} playbackRate={1} />,
    )

    const video = container.querySelector('video')!

    // play() deferred until loadeddata
    fireEvent.loadedData(video)
    expect(playSpy).toHaveBeenCalledTimes(1)

    // Change src while still playing
    rerender(
      <VideoPlayer src="media:///video-b.mp4" currentTime={0} playing={true} playbackRate={1} />,
    )

    // New source fires loadeddata → play() called again
    fireEvent.loadedData(video)
    expect(playSpy).toHaveBeenCalledTimes(2)
  })

  it('does NOT call play() when src changes while paused', () => {
    const { rerender } = render(
      <VideoPlayer src="media:///video-a.mp4" currentTime={0} playing={false} playbackRate={1} />,
    )

    rerender(
      <VideoPlayer src="media:///video-b.mp4" currentTime={0} playing={false} playbackRate={1} />,
    )

    // play() should never be called — paused the whole time
    expect(playSpy).not.toHaveBeenCalled()
  })
})

// =============================================================================
// Test 2: TransportControls accepts seekTo prop (no internal usePlayhead)
// =============================================================================

describe('TransportControls — seekTo prop', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: {
        id: 'tl-1',
        projectId: 'p-1',
        tracks: [],
        syncPoints: [],
        duration: 60000,
        reviewed: false,
      },
      playheadPosition: 30000,
      isPlaying: false,
      playbackRate: 1,
    })
  })

  it('calls seekTo prop when step-forward is clicked', () => {
    const seekTo = vi.fn()
    const { container } = render(<TransportControls seekTo={seekTo} />)

    // Step forward button is the 4th transport-btn
    const buttons = container.querySelectorAll('.transport-btn')
    const stepForwardBtn = buttons[3] as HTMLElement
    fireEvent.click(stepForwardBtn)

    expect(seekTo).toHaveBeenCalledWith(35000) // 30000 + 5000
  })

  it('calls seekTo prop when go-to-start is clicked', () => {
    const seekTo = vi.fn()
    const { container } = render(<TransportControls seekTo={seekTo} />)

    const buttons = container.querySelectorAll('.transport-btn')
    const goToStartBtn = buttons[0] as HTMLElement
    fireEvent.click(goToStartBtn)

    expect(seekTo).toHaveBeenCalledWith(0)
  })
})

// =============================================================================
// Test 3: PlaybackPanel switches segment via emitter during playback
// =============================================================================

describe('PlaybackPanel — real-time segment switching via emitter', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: makeTwoSegmentTimeline(),
      playheadPosition: 1000,
      isPlaying: true,
      playbackRate: 1,
    })
    useLibraryStore.setState({ clips: makeClips() })
  })

  it('switches video src when emitter position crosses segment boundary', async () => {
    const { container } = render(<PlaybackPanel />)

    // Initially showing video-a (playheadPosition=1000 is in seg-1)
    const videoA = container.querySelector('video')
    expect(videoA?.getAttribute('src')).toBe('media:///video-a.mp4')

    // Emit position in segment 2 (> 5000)
    act(() => {
      playheadEmitter.emit('position', 6000)
    })

    // Should now show video-b
    const videoB = container.querySelector('video')
    expect(videoB?.getAttribute('src')).toBe('media:///video-b.mp4')
  })

  it('uses store position when paused (not emitter)', () => {
    useTimelineStore.setState({ isPlaying: false, playheadPosition: 1000 })

    const { container } = render(<PlaybackPanel />)

    // Emit a position in segment 2 — should be ignored when paused
    act(() => {
      playheadEmitter.emit('position', 6000)
    })

    // Should still show video-a based on store position
    const video = container.querySelector('video')
    expect(video?.getAttribute('src')).toBe('media:///video-a.mp4')
  })
})

// =============================================================================
// Test 4: Play-from-end resets position to 0
// =============================================================================

describe('usePlayhead — play-from-end reset', () => {
  const rafCallbacks: FrameRequestCallback[] = []

  beforeEach(() => {
    rafCallbacks.length = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    useTimelineStore.setState({
      timeline: {
        id: 'tl-1',
        projectId: 'p-1',
        tracks: [
          {
            id: 'track-1',
            type: 'clip',
            segments: [makeSegment({ startTime: 0, endTime: 5000 })],
            zOrder: 0,
            label: 'Video',
            muted: false,
            locked: false,
          },
        ],
        syncPoints: [],
        duration: 5000,
        reviewed: false,
      },
      playheadPosition: 5000, // at the end
      isPlaying: false,
      playbackRate: 1,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resets playhead to 0 when play starts at end of timeline', async () => {
    // Lazy import to get hook after mocks
    const { usePlayhead } = await import('../../src/renderer/hooks/usePlayhead')

    let hookSeekTo: (timeMs: number) => void

    function TestHarness() {
      const { seekTo } = usePlayhead()
      hookSeekTo = seekTo
      return null
    }

    render(<TestHarness />)

    // Simulate previous playback having reached the end via seekTo
    // (this sets positionRef.current = 5000)
    act(() => {
      hookSeekTo!(5000)
    })

    expect(useTimelineStore.getState().playheadPosition).toBe(5000)

    // Now start playing from the end
    act(() => {
      useTimelineStore.getState().setIsPlaying(true)
    })

    // Position should have been reset to 0
    expect(useTimelineStore.getState().playheadPosition).toBe(0)
  })
})
