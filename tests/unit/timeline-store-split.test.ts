// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'
import type { ScriptSection } from '@shared/types/ai'

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 10000,
    sourceFile: '/path/to/video.mp4',
    sourceOffset: 0,
    label: 'Original Segment',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments: [makeSegment()],
    zOrder: 0,
    label: 'Video',
    muted: false,
    locked: false,
    ...overrides,
  }
}

function makeTimeline(overrides: Partial<SyncTimeline> = {}): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'proj-1',
    tracks: [makeTrack()],
    syncPoints: [],
    duration: 10000,
    reviewed: false,
    ...overrides,
  }
}

function makeSection(overrides: Partial<ScriptSection> = {}): ScriptSection {
  return {
    id: 'sec-1',
    text: 'Hello world section',
    order: 0,
    eventIds: [],
    voiceProfileId: 'default',
    ...overrides,
  } as ScriptSection
}

describe('timeline-store: splitClipBySections', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: null })
  })

  it('splits a 10s segment into 3 parts proportional to word counts [10, 20, 10]', () => {
    // 10 words + 20 words + 10 words = 40 total words
    // durations: 2500ms, 5000ms, 2500ms
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })

    const sections: ScriptSection[] = [
      makeSection({ id: 'sec-1', text: 'one two three four five six seven eight nine ten', order: 0 }),
      makeSection({ id: 'sec-2', text: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty', order: 1 }),
      makeSection({ id: 'sec-3', text: 'one two three four five six seven eight nine ten', order: 2 }),
    ]

    useTimelineStore.getState().splitClipBySections('seg-1', sections)

    const state = useTimelineStore.getState()
    const segments = state.timeline!.tracks[0].segments

    expect(segments).toHaveLength(3)
    // Total duration preserved
    expect(segments[segments.length - 1].endTime).toBeCloseTo(10000, 1)
    // First segment starts at 0
    expect(segments[0].startTime).toBe(0)
    // First segment (10/40 * 10000 = 2500ms)
    expect(segments[0].endTime).toBeCloseTo(2500, 1)
    // Second segment (20/40 * 10000 = 5000ms after 2500 = 7500ms end)
    expect(segments[1].startTime).toBeCloseTo(2500, 1)
    expect(segments[1].endTime).toBeCloseTo(7500, 1)
    // Third segment
    expect(segments[2].startTime).toBeCloseTo(7500, 1)
    expect(segments[2].endTime).toBeCloseTo(10000, 1)
  })

  it('preserves sourceFile from original segment', () => {
    const seg = makeSegment({ sourceFile: '/recordings/original.webm' })
    const timeline = makeTimeline({ tracks: [makeTrack({ segments: [seg] })] })
    useTimelineStore.setState({ timeline })

    const sections: ScriptSection[] = [
      makeSection({ id: 'sec-a', text: 'hello world', order: 0 }),
      makeSection({ id: 'sec-b', text: 'foo bar', order: 1 }),
    ]

    useTimelineStore.getState().splitClipBySections('seg-1', sections)

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    expect(segments).toHaveLength(2)
    for (const s of segments) {
      expect(s.sourceFile).toBe('/recordings/original.webm')
    }
  })

  it('sets metadata with sectionId and sectionOrder', () => {
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })

    const sections: ScriptSection[] = [
      makeSection({ id: 'my-section', text: 'hello world test', order: 3 }),
    ]

    useTimelineStore.getState().splitClipBySections('seg-1', sections)

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    expect(segments).toHaveLength(1)

    const parsed = JSON.parse(segments[0].metadata!)
    expect(parsed.sectionId).toBe('my-section')
    expect(parsed.sectionOrder).toBe(3)
  })

  it('does not change state when sections array is empty', () => {
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })

    useTimelineStore.getState().splitClipBySections('seg-1', [])

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    // Empty sections → totalWordCount=0 → no change
    expect(segments).toHaveLength(1)
    expect(segments[0].id).toBe('seg-1')
  })

  it('does not change state when segmentId does not exist', () => {
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })

    const sections: ScriptSection[] = [
      makeSection({ id: 'sec-x', text: 'hello world', order: 0 }),
    ]

    useTimelineStore.getState().splitClipBySections('non-existent-seg', sections)

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    expect(segments).toHaveLength(1)
    expect(segments[0].id).toBe('seg-1')
  })

  it('truncates segment label to 40 characters', () => {
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })

    const longText = 'This is a very long section text that exceeds forty characters in length when used as label'
    const sections: ScriptSection[] = [
      makeSection({ id: 'sec-long', text: longText, order: 0 }),
    ]

    useTimelineStore.getState().splitClipBySections('seg-1', sections)

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    expect(segments).toHaveLength(1)
    expect(segments[0].label.length).toBeLessThanOrEqual(40)
    expect(segments[0].label).toBe(longText.slice(0, 40))
  })

  it('handles sections with all-whitespace gracefully (filtered by Boolean)', () => {
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })

    // "  " splits to ["", ""] → filter(Boolean) removes them → wordCount=0 for blank
    // section "hello world" has 2 words → will produce one segment
    const sections: ScriptSection[] = [
      makeSection({ id: 'sec-blank', text: '   ', order: 0 }),
      makeSection({ id: 'sec-words', text: 'hello world', order: 1 }),
    ]

    useTimelineStore.getState().splitClipBySections('seg-1', sections)

    // blank section has 0 words → 0 duration, words section has all duration
    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    // Both sections produce segments (including 0-duration for blank)
    expect(segments).toHaveLength(2)
  })
})

describe('timeline-store: adjustSegmentDuration', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: null })
  })

  it('adjusting middle segment longer shifts subsequent segments right by delta', () => {
    // 3 segments: 0-3000, 3000-6000, 6000-10000
    const track: Track = {
      id: 'track-1',
      type: 'clip',
      segments: [
        makeSegment({ id: 'seg-a', startTime: 0, endTime: 3000, trackId: 'track-1' }),
        makeSegment({ id: 'seg-b', startTime: 3000, endTime: 6000, trackId: 'track-1' }),
        makeSegment({ id: 'seg-c', startTime: 6000, endTime: 10000, trackId: 'track-1' }),
      ],
      zOrder: 0,
      label: 'Video',
      muted: false,
      locked: false,
    }
    const timeline = makeTimeline({ tracks: [track], duration: 10000 })
    useTimelineStore.setState({ timeline })

    // Extend seg-b from 3000ms to 4000ms (delta = +1000ms)
    useTimelineStore.getState().adjustSegmentDuration('seg-b', 4000)

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments

    const a = segments.find((s) => s.id === 'seg-a')!
    const b = segments.find((s) => s.id === 'seg-b')!
    const c = segments.find((s) => s.id === 'seg-c')!

    // seg-a unchanged
    expect(a.startTime).toBe(0)
    expect(a.endTime).toBe(3000)
    // seg-b extended
    expect(b.startTime).toBe(3000)
    expect(b.endTime).toBe(7000)
    // seg-c shifted right by 1000ms
    expect(c.startTime).toBe(7000)
    expect(c.endTime).toBe(11000)
  })

  it('adjusting middle segment shorter shifts subsequent segments left', () => {
    const track: Track = {
      id: 'track-1',
      type: 'clip',
      segments: [
        makeSegment({ id: 'seg-a', startTime: 0, endTime: 3000, trackId: 'track-1' }),
        makeSegment({ id: 'seg-b', startTime: 3000, endTime: 6000, trackId: 'track-1' }),
        makeSegment({ id: 'seg-c', startTime: 6000, endTime: 10000, trackId: 'track-1' }),
      ],
      zOrder: 0,
      label: 'Video',
      muted: false,
      locked: false,
    }
    const timeline = makeTimeline({ tracks: [track], duration: 10000 })
    useTimelineStore.setState({ timeline })

    // Shorten seg-b from 3000ms to 2000ms (delta = -1000ms)
    useTimelineStore.getState().adjustSegmentDuration('seg-b', 2000)

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments

    const a = segments.find((s) => s.id === 'seg-a')!
    const b = segments.find((s) => s.id === 'seg-b')!
    const c = segments.find((s) => s.id === 'seg-c')!

    expect(a.startTime).toBe(0)
    expect(a.endTime).toBe(3000)
    expect(b.startTime).toBe(3000)
    expect(b.endTime).toBe(5000)
    expect(c.startTime).toBe(5000)
    expect(c.endTime).toBe(9000)
  })

  it('enforces minimum duration of 100ms', () => {
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })

    // Try to set duration to 0 — should clamp to 100ms
    useTimelineStore.getState().adjustSegmentDuration('seg-1', 0)

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    const seg = segments.find((s) => s.id === 'seg-1')!
    expect(seg.endTime - seg.startTime).toBe(100)
  })

  it('no change when delta is zero', () => {
    // seg-1 is 0-10000 (10000ms duration)
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })
    const before = useTimelineStore.getState().timeline

    useTimelineStore.getState().adjustSegmentDuration('seg-1', 10000)

    const after = useTimelineStore.getState().timeline
    // delta=0 → same state reference returned
    expect(after).toBe(before)
  })

  it('no change when segmentId does not exist', () => {
    const timeline = makeTimeline()
    useTimelineStore.setState({ timeline })
    const before = useTimelineStore.getState().timeline

    useTimelineStore.getState().adjustSegmentDuration('ghost-seg', 5000)

    const after = useTimelineStore.getState().timeline
    expect(after).toBe(before)
  })

  it('only shifts segments in the same track, not segments in other tracks', () => {
    const track1: Track = {
      id: 'track-1',
      type: 'clip',
      segments: [
        makeSegment({ id: 'seg-a', startTime: 0, endTime: 5000, trackId: 'track-1' }),
        makeSegment({ id: 'seg-b', startTime: 5000, endTime: 10000, trackId: 'track-1' }),
      ],
      zOrder: 0,
      label: 'Video',
      muted: false,
      locked: false,
    }
    const track2: Track = {
      id: 'track-2',
      type: 'recording',
      segments: [
        makeSegment({ id: 'seg-c', startTime: 5000, endTime: 10000, trackId: 'track-2' }),
      ],
      zOrder: 1,
      label: 'Script Audio',
      muted: false,
      locked: false,
    }
    const timeline = makeTimeline({ tracks: [track1, track2], duration: 10000 })
    useTimelineStore.setState({ timeline })

    // Extend seg-a in track-1 by 2000ms
    useTimelineStore.getState().adjustSegmentDuration('seg-a', 7000)

    const state = useTimelineStore.getState().timeline!
    const t1segs = state.tracks.find((t) => t.id === 'track-1')!.segments
    const t2segs = state.tracks.find((t) => t.id === 'track-2')!.segments

    // seg-b in track-1 should shift right
    const segB = t1segs.find((s) => s.id === 'seg-b')!
    expect(segB.startTime).toBe(7000)
    expect(segB.endTime).toBe(12000)

    // seg-c in track-2 should be unchanged
    const segC = t2segs.find((s) => s.id === 'seg-c')!
    expect(segC.startTime).toBe(5000)
    expect(segC.endTime).toBe(10000)
  })
})
