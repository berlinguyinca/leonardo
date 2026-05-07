// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseOverlayMetadata,
  defaultOverlayMetadata,
  type OverlayType,
} from '../../src/shared/types/overlay'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline } from '@shared/types'

function makeTimeline(overrides: Partial<SyncTimeline> = {}): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'proj-1',
    tracks: [],
    syncPoints: [],
    duration: 0,
    reviewed: false,
    ...overrides,
  }
}

// --- parseOverlayMetadata tests ---

describe('parseOverlayMetadata', () => {
  it('returns null for undefined metadata', () => {
    expect(parseOverlayMetadata({})).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseOverlayMetadata({ metadata: 'not-json' })).toBeNull()
  })

  it('returns null when element.id is missing', () => {
    const bad = JSON.stringify({ element: { overlayType: 'intro' } })
    expect(parseOverlayMetadata({ metadata: bad })).toBeNull()
  })

  it('returns null when element.overlayType is missing', () => {
    const bad = JSON.stringify({ element: { id: 'abc' } })
    expect(parseOverlayMetadata({ metadata: bad })).toBeNull()
  })

  it('returns valid metadata for well-formed input', () => {
    const meta = defaultOverlayMetadata('intro')
    const result = parseOverlayMetadata({ metadata: JSON.stringify(meta) })
    expect(result).not.toBeNull()
    expect(result!.element.overlayType).toBe('intro')
    expect(result!.element.text).toBe('Introduction')
  })
})

// --- defaultOverlayMetadata tests ---

describe('defaultOverlayMetadata', () => {
  const cases: Array<[OverlayType, string]> = [
    ['intro', 'Introduction'],
    ['exit', 'Thank You'],
    ['title', 'Title'],
    ['section', 'Section'],
  ]

  for (const [type, expectedText] of cases) {
    it(`creates correct defaults for overlayType="${type}"`, () => {
      const meta = defaultOverlayMetadata(type)
      expect(meta.element.overlayType).toBe(type)
      expect(meta.element.text).toBe(expectedText)
      expect(meta.element.transitionIn).toBe('fade')
      expect(meta.element.transitionOut).toBe('fade')
      expect(meta.element.transitionDuration).toBe(500)
      expect(meta.element.fontFamily).toBe('Inter')
      expect(meta.element.fontSize).toBe(32)
      expect(meta.element.color).toBe('#ffffff')
      expect(meta.element.backgroundColor).toBe('#000000')
      expect(meta.element.backgroundOpacity).toBe(0.7)
      expect(meta.element.id).toBeTruthy()
    })
  }
})

// --- timeline-store overlay actions ---

describe('addOverlaySegment', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: makeTimeline(), playheadPosition: 0 })
    useTimelineStore.temporal.getState().clear()
  })

  it('creates an overlay track and segment when none exists', () => {
    useTimelineStore.getState().addOverlaySegment('intro', 0)
    const { timeline } = useTimelineStore.getState()
    const overlayTrack = timeline!.tracks.find((t) => t.type === 'overlay')
    expect(overlayTrack).toBeDefined()
    expect(overlayTrack!.segments).toHaveLength(1)
    const seg = overlayTrack!.segments[0]
    expect(seg.label).toBe('intro')
    expect(seg.sourceFile).toBe('')
    expect(seg.startTime).toBe(0)
    expect(seg.endTime).toBe(3000) // default duration
    const meta = parseOverlayMetadata(seg)
    expect(meta!.element.overlayType).toBe('intro')
  })

  it('reuses existing overlay track when one already exists', () => {
    useTimelineStore.getState().addOverlaySegment('title', 0)
    useTimelineStore.getState().addOverlaySegment('section', 5000)
    const { timeline } = useTimelineStore.getState()
    const overlayTracks = timeline!.tracks.filter((t) => t.type === 'overlay')
    expect(overlayTracks).toHaveLength(1)
    expect(overlayTracks[0].segments).toHaveLength(2)
  })

  it('respects custom durationMs', () => {
    useTimelineStore.getState().addOverlaySegment('exit', 1000, 7000)
    const { timeline } = useTimelineStore.getState()
    const seg = timeline!.tracks.find((t) => t.type === 'overlay')!.segments[0]
    expect(seg.startTime).toBe(1000)
    expect(seg.endTime).toBe(8000)
  })

  it('updates timeline duration to include overlay segment', () => {
    useTimelineStore.getState().addOverlaySegment('intro', 10000, 2000)
    const { timeline } = useTimelineStore.getState()
    expect(timeline!.duration).toBe(12000)
  })
})

describe('updateSegmentMetadata', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: makeTimeline(), playheadPosition: 0 })
    useTimelineStore.temporal.getState().clear()
  })

  it('updates metadata on the matching segment', () => {
    useTimelineStore.getState().addOverlaySegment('title', 0)
    const { timeline } = useTimelineStore.getState()
    const seg = timeline!.tracks.find((t) => t.type === 'overlay')!.segments[0]
    const newMeta = JSON.stringify({ element: { id: seg.id, overlayType: 'title', text: 'Updated' } })
    useTimelineStore.getState().updateSegmentMetadata(seg.id, newMeta)
    const updated = useTimelineStore.getState().timeline!.tracks
      .find((t) => t.type === 'overlay')!.segments[0]
    expect(updated.metadata).toBe(newMeta)
  })

  it('does nothing when timeline is null', () => {
    useTimelineStore.setState({ timeline: null })
    expect(() =>
      useTimelineStore.getState().updateSegmentMetadata('nonexistent', '{}')
    ).not.toThrow()
  })
})

describe('removeSegment on overlay segment', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: makeTimeline(), playheadPosition: 0 })
    useTimelineStore.temporal.getState().clear()
  })

  it('removes an overlay segment by id', () => {
    useTimelineStore.getState().addOverlaySegment('intro', 0)
    const { timeline } = useTimelineStore.getState()
    const seg = timeline!.tracks.find((t) => t.type === 'overlay')!.segments[0]
    useTimelineStore.getState().removeSegment(seg.id)
    const afterRemove = useTimelineStore.getState().timeline!
    const overlayTrack = afterRemove.tracks.find((t) => t.type === 'overlay')!
    expect(overlayTrack.segments).toHaveLength(0)
  })
})
