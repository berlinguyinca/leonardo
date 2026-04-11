// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'

vi.mock('../../src/renderer/hooks/usePlayhead', () => ({
  usePlayhead: () => ({ seekTo: vi.fn() }),
}))
vi.mock('../../src/renderer/hooks/useTimelineZoom', () => ({
  useTimelineZoom: () => ({ zoom: vi.fn(), handleWheel: vi.fn() }),
}))
vi.mock('../../src/renderer/components/timeline/TimeRuler', () => ({
  TimeRuler: () => null,
}))
vi.mock('../../src/renderer/components/timeline/Playhead', () => ({
  Playhead: () => null,
}))
vi.mock('../../src/renderer/components/timeline/TrackLane', () => ({
  TrackLane: () => null,
}))
vi.mock('../../src/renderer/components/timeline/ScrollContainer', () => ({
  ScrollContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../../src/renderer/components/timeline/ZoomControls', () => ({
  ZoomControls: () => null,
}))
vi.mock('../../src/renderer/components/timeline/TransportControls', () => ({
  TransportControls: () => null,
}))
vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: { clips: never[] }) => unknown) => selector({ clips: [] }),
}))

// Import after mocks
import { Timeline } from '../../src/renderer/components/timeline/Timeline'

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 3000,
    sourceFile: '/tmp/video.mp4',
    sourceOffset: 0,
    label: 'Seg 1',
    ...overrides,
  }
}

function makeTrack(segments: Segment[]): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments,
    zOrder: 0,
    label: 'Track',
    muted: false,
    locked: false,
  }
}

function makeTimeline(tracks: Track[]): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'proj-1',
    tracks,
    syncPoints: [],
    duration: 3000,
    reviewed: false,
  }
}

describe('Timeline: delete key removes selected segment', () => {
  beforeEach(() => {
    const seg = makeSegment()
    const track = makeTrack([seg])
    const timeline = makeTimeline([track])
    useTimelineStore.setState({ timeline, selectedSegmentId: null })
    useTimelineStore.temporal.getState().clear()
  })

  it('Delete key removes the selected segment and clears selection', () => {
    useTimelineStore.setState({ selectedSegmentId: 'seg-1' })
    render(<Timeline />)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    })

    const state = useTimelineStore.getState()
    expect(state.selectedSegmentId).toBeNull()
    expect(state.timeline!.tracks[0].segments).toHaveLength(0)
  })

  it('Backspace key removes the selected segment and clears selection', () => {
    useTimelineStore.setState({ selectedSegmentId: 'seg-1' })
    render(<Timeline />)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    })

    const state = useTimelineStore.getState()
    expect(state.selectedSegmentId).toBeNull()
    expect(state.timeline!.tracks[0].segments).toHaveLength(0)
  })

  it('Delete key does nothing when selectedSegmentId is null', () => {
    useTimelineStore.setState({ selectedSegmentId: null })
    render(<Timeline />)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    })

    const state = useTimelineStore.getState()
    expect(state.timeline!.tracks[0].segments).toHaveLength(1)
  })

  it('Delete key does nothing when target is a textarea', () => {
    useTimelineStore.setState({ selectedSegmentId: 'seg-1' })
    render(<Timeline />)

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    })

    const state = useTimelineStore.getState()
    // segment should still be there since handler ignores textarea targets
    expect(state.timeline!.tracks[0].segments).toHaveLength(1)
    expect(state.selectedSegmentId).toBe('seg-1')

    document.body.removeChild(textarea)
  })

  it('Delete key does nothing when target is an input', () => {
    useTimelineStore.setState({ selectedSegmentId: 'seg-1' })
    render(<Timeline />)

    const input = document.createElement('input')
    document.body.appendChild(input)

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    })

    const state = useTimelineStore.getState()
    expect(state.timeline!.tracks[0].segments).toHaveLength(1)
    expect(state.selectedSegmentId).toBe('seg-1')

    document.body.removeChild(input)
  })
})
