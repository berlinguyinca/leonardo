// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'

function makeTimeline(overrides: Partial<SyncTimeline> = {}): SyncTimeline {
  return {
    id: 'timeline-1',
    projectId: 'proj-1',
    tracks: [],
    syncPoints: [],
    duration: 0,
    reviewed: false,
    ...overrides,
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments: [],
    zOrder: 0,
    label: 'Track 1',
    muted: false,
    locked: false,
    ...overrides,
  }
}

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 3000,
    sourceFile: '/some/file.webm',
    sourceOffset: 0,
    label: 'Seg 1',
    ...overrides,
  }
}

describe('timeline-store: removeSegment', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: null })
    useTimelineStore.temporal.getState().clear()
  })

  it('removes the correct segment from a track', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const seg2 = makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000 })
    const track = makeTrack({ segments: [seg1, seg2] })
    const timeline = makeTimeline({ tracks: [track], duration: 6000 })
    useTimelineStore.setState({ timeline })

    useTimelineStore.getState().removeSegment('seg-1')

    const state = useTimelineStore.getState()
    expect(state.timeline!.tracks[0].segments).toHaveLength(1)
    expect(state.timeline!.tracks[0].segments[0].id).toBe('seg-2')
  })

  it('updates duration after segment removal', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const seg2 = makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000 })
    const track = makeTrack({ segments: [seg1, seg2] })
    const timeline = makeTimeline({ tracks: [track], duration: 6000 })
    useTimelineStore.setState({ timeline })

    useTimelineStore.getState().removeSegment('seg-2')

    const state = useTimelineStore.getState()
    expect(state.timeline!.duration).toBe(3000)
  })

  it('leaves other segments unchanged', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const seg2 = makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000 })
    const seg3 = makeSegment({ id: 'seg-3', startTime: 6000, endTime: 9000 })
    const track = makeTrack({ segments: [seg1, seg2, seg3] })
    const timeline = makeTimeline({ tracks: [track], duration: 9000 })
    useTimelineStore.setState({ timeline })

    useTimelineStore.getState().removeSegment('seg-2')

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    expect(segments).toHaveLength(2)
    expect(segments[0].id).toBe('seg-1')
    expect(segments[1].id).toBe('seg-3')
  })

  it('is a no-op on unknown segment id', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const track = makeTrack({ segments: [seg1] })
    const timeline = makeTimeline({ tracks: [track], duration: 3000 })
    useTimelineStore.setState({ timeline })

    useTimelineStore.getState().removeSegment('nonexistent-id')

    const state = useTimelineStore.getState()
    expect(state.timeline!.tracks[0].segments).toHaveLength(1)
    expect(state.timeline!.tracks[0].segments[0].id).toBe('seg-1')
    expect(state.timeline!.duration).toBe(3000)
  })

  it('is a no-op when timeline is null', () => {
    useTimelineStore.setState({ timeline: null })
    useTimelineStore.getState().removeSegment('seg-1')
    expect(useTimelineStore.getState().timeline).toBeNull()
  })
})
