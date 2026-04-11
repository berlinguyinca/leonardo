// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment, Clip } from '@shared/types'

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

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/recordings/clip-1/recording.webm',
    duration: 5000,
    url: 'https://example.com',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-04-10T12:00:00Z',
    label: 'My Clip',
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

describe('timeline-store: addClipToTimeline', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: null })
  })

  it('auto-creates a timeline when timeline is null', () => {
    const clip = makeClip({ projectId: 'proj-1' })
    useTimelineStore.getState().addClipToTimeline(clip)
    const state = useTimelineStore.getState()
    expect(state.timeline).not.toBeNull()
    expect(state.timeline!.projectId).toBe('proj-1')
    expect(state.timeline!.tracks).toHaveLength(1)
    expect(state.timeline!.tracks[0].segments).toHaveLength(1)
    expect(state.timeline!.tracks[0].segments[0].startTime).toBe(0)
    expect(state.timeline!.tracks[0].segments[0].endTime).toBe(clip.duration)
  })

  it('creates a new clip track when no clip or recording track exists', () => {
    const timeline = makeTimeline({ tracks: [] })
    useTimelineStore.setState({ timeline })

    const clip = makeClip({ duration: 5000, filePath: '/rec/clip.webm', label: 'My Clip' })
    useTimelineStore.getState().addClipToTimeline(clip)

    const state = useTimelineStore.getState()
    expect(state.timeline).not.toBeNull()
    const tracks = state.timeline!.tracks
    expect(tracks).toHaveLength(1)

    const newTrack = tracks[0]
    expect(newTrack.type).toBe('clip')
    expect(newTrack.label).toBe('Recordings')
    expect(newTrack.muted).toBe(false)
    expect(newTrack.locked).toBe(false)
    expect(newTrack.zOrder).toBe(0)
    expect(newTrack.segments).toHaveLength(1)

    const seg = newTrack.segments[0]
    expect(seg.trackId).toBe(newTrack.id)
    expect(seg.startTime).toBe(0)
    expect(seg.endTime).toBe(5000)
    expect(seg.sourceFile).toBe('/rec/clip.webm')
    expect(seg.sourceOffset).toBe(0)
    expect(seg.label).toBe('My Clip')
    expect(typeof seg.id).toBe('string')
    expect(seg.id.length).toBeGreaterThan(0)
  })

  it('appends a segment to an existing clip track after the last segment endTime', () => {
    const existingSegment = makeSegment({ startTime: 0, endTime: 3000 })
    const existingTrack = makeTrack({ id: 'track-1', type: 'clip', segments: [existingSegment] })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    const clip = makeClip({ duration: 2000 })
    useTimelineStore.getState().addClipToTimeline(clip)

    const tracks = useTimelineStore.getState().timeline!.tracks
    expect(tracks).toHaveLength(1)
    expect(tracks[0].segments).toHaveLength(2)

    const newSeg = tracks[0].segments[1]
    expect(newSeg.startTime).toBe(3000)
    expect(newSeg.endTime).toBe(5000)
    expect(newSeg.trackId).toBe('track-1')
  })

  it('appends a segment to an existing recording track after the last segment endTime', () => {
    const existingSegment = makeSegment({ startTime: 1000, endTime: 4000 })
    const existingTrack = makeTrack({
      id: 'track-rec',
      type: 'recording',
      segments: [existingSegment],
    })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    const clip = makeClip({ duration: 3000 })
    useTimelineStore.getState().addClipToTimeline(clip)

    const tracks = useTimelineStore.getState().timeline!.tracks
    expect(tracks).toHaveLength(1)
    expect(tracks[0].segments).toHaveLength(2)

    const newSeg = tracks[0].segments[1]
    expect(newSeg.startTime).toBe(4000)
    expect(newSeg.endTime).toBe(7000)
    expect(newSeg.trackId).toBe('track-rec')
  })

  it('uses insertTimeMs as startTime when provided', () => {
    const existingSegment = makeSegment({ startTime: 0, endTime: 3000 })
    const existingTrack = makeTrack({ id: 'track-1', type: 'clip', segments: [existingSegment] })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    const clip = makeClip({ duration: 2000 })
    useTimelineStore.getState().addClipToTimeline(clip, 10000)

    const tracks = useTimelineStore.getState().timeline!.tracks
    const newSeg = tracks[0].segments[1]
    expect(newSeg.startTime).toBe(10000)
    expect(newSeg.endTime).toBe(12000)
  })

  it('uses insertTimeMs = 0 when explicitly provided as 0', () => {
    const existingSegment = makeSegment({ startTime: 5000, endTime: 8000 })
    const existingTrack = makeTrack({ id: 'track-1', type: 'clip', segments: [existingSegment] })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    const clip = makeClip({ duration: 2000 })
    useTimelineStore.getState().addClipToTimeline(clip, 0)

    const tracks = useTimelineStore.getState().timeline!.tracks
    const newSeg = tracks[0].segments[1]
    expect(newSeg.startTime).toBe(0)
    expect(newSeg.endTime).toBe(2000)
  })

  it('appends after the latest endTime when a track has multiple segments', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const seg2 = makeSegment({ id: 'seg-2', startTime: 5000, endTime: 9000 })
    const seg3 = makeSegment({ id: 'seg-3', startTime: 10000, endTime: 11000 })
    const existingTrack = makeTrack({
      id: 'track-1',
      type: 'clip',
      segments: [seg1, seg2, seg3],
    })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    const clip = makeClip({ duration: 4000 })
    useTimelineStore.getState().addClipToTimeline(clip)

    const tracks = useTimelineStore.getState().timeline!.tracks
    expect(tracks[0].segments).toHaveLength(4)
    const newSeg = tracks[0].segments[3]
    expect(newSeg.startTime).toBe(11000)
    expect(newSeg.endTime).toBe(15000)
  })

  it('starts segment at 0 when existing track has no segments', () => {
    const existingTrack = makeTrack({ id: 'track-1', type: 'clip', segments: [] })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    const clip = makeClip({ duration: 2000 })
    useTimelineStore.getState().addClipToTimeline(clip)

    const tracks = useTimelineStore.getState().timeline!.tracks
    expect(tracks[0].segments).toHaveLength(1)
    const newSeg = tracks[0].segments[0]
    expect(newSeg.startTime).toBe(0)
    expect(newSeg.endTime).toBe(2000)
  })

  it('allows insertion at insertTimeMs even if it overlaps existing segment', () => {
    // existing segment from 0ms to 3000ms
    const existingSegment = makeSegment({ startTime: 0, endTime: 3000 })
    const existingTrack = makeTrack({ id: 'track-1', type: 'clip', segments: [existingSegment] })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    // insert new clip at 1000ms with 2000ms duration → segment 1000–3000ms (overlaps)
    // overlap is allowed — caller is responsible
    const clip = makeClip({ duration: 2000 })
    useTimelineStore.getState().addClipToTimeline(clip, 1000)

    const tracks = useTimelineStore.getState().timeline!.tracks
    expect(tracks[0].segments).toHaveLength(2)

    const newSeg = tracks[0].segments[1]
    expect(newSeg.startTime).toBe(1000)
    expect(newSeg.endTime).toBe(3000)
  })

  it('is a no-op if clip duration is zero or negative', () => {
    const existingSegment = makeSegment({ startTime: 0, endTime: 3000 })
    const existingTrack = makeTrack({ id: 'track-1', type: 'clip', segments: [existingSegment] })
    const timeline = makeTimeline({ tracks: [existingTrack] })
    useTimelineStore.setState({ timeline })

    const originalTracks = useTimelineStore.getState().timeline!.tracks

    const zeroDurationClip = makeClip({ duration: 0 })
    useTimelineStore.getState().addClipToTimeline(zeroDurationClip)

    const afterZero = useTimelineStore.getState().timeline!.tracks
    expect(afterZero[0].segments).toHaveLength(1)
    expect(afterZero).toStrictEqual(originalTracks)

    const negativeDurationClip = makeClip({ duration: -100 })
    useTimelineStore.getState().addClipToTimeline(negativeDurationClip)

    const afterNegative = useTimelineStore.getState().timeline!.tracks
    expect(afterNegative[0].segments).toHaveLength(1)
    expect(afterNegative).toStrictEqual(originalTracks)
  })

  it('creates unique ids for segment and track', () => {
    const timeline = makeTimeline({ tracks: [] })
    useTimelineStore.setState({ timeline })

    const clip1 = makeClip({ id: 'clip-1', duration: 1000 })
    const clip2 = makeClip({ id: 'clip-2', duration: 2000 })
    useTimelineStore.getState().addClipToTimeline(clip1)
    useTimelineStore.getState().addClipToTimeline(clip2)

    const tracks = useTimelineStore.getState().timeline!.tracks
    expect(tracks).toHaveLength(1)
    const [seg1, seg2] = tracks[0].segments
    expect(seg1.id).not.toBe(seg2.id)
  })
})
