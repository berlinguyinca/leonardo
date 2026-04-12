// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'
import { render, fireEvent } from '@testing-library/react'

const FRAME_MS = Math.round(1000 / 15)

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/tmp/video.mp4',
    sourceOffset: 0,
    label: 'Clip',
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

function makeTimeline(tracks: Track[], duration = 35000): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks,
    syncPoints: [],
    duration,
    reviewed: false,
  }
}

// Stub window.leonardo for components that check it
beforeEach(() => {
  ;(window as Record<string, unknown>).leonardo = { clip: { getThumbnails: async () => [] } }
})

// --- Global shortcuts (Space, Cmd+Z) via window ---

import { renderHook } from '@testing-library/react'
import { useUndoRedo } from '../../src/renderer/hooks/useUndoRedo'

function fireWindowKey(key: string, opts: { shiftKey?: boolean; metaKey?: boolean } = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

describe('Global keyboard shortcuts (useUndoRedo)', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: makeTimeline([
        makeTrack([makeSegment({ id: 'seg-1', startTime: 10000, endTime: 20000 })]),
      ]),
      playheadPosition: 15000,
      isPlaying: false,
      playbackRate: 1,
    })
    renderHook(() => useUndoRedo())
  })

  it('Space starts playback when paused', () => {
    fireWindowKey(' ')
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })

  it('Space pauses when playing', () => {
    useTimelineStore.setState({ isPlaying: true })
    fireWindowKey(' ')
    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })
})

// --- Timeline-scoped shortcuts (rendered in Timeline component) ---

import { Timeline } from '../../src/renderer/components/timeline/Timeline'

function renderTimeline() {
  const result = render(<Timeline />)
  const container = result.container.querySelector('.timeline-container') as HTMLElement
  // Focus the container so keyboard events fire
  container?.focus()
  return { ...result, container: container! }
}

function fireTimelineKey(container: HTMLElement, key: string) {
  fireEvent.keyDown(container, { key })
}

describe('Timeline-scoped keyboard shortcuts', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: makeTimeline([
        makeTrack([
          makeSegment({ id: 'seg-1', startTime: 10000, endTime: 20000 }),
          makeSegment({ id: 'seg-2', startTime: 20000, endTime: 35000 }),
        ]),
      ], 35000),
      playheadPosition: 15000,
      isPlaying: false,
      playbackRate: 1,
      selectedSegmentId: null,
    })
  })

  describe('ArrowRight/Left — frame stepping', () => {
    it('ArrowRight steps forward 1 frame', () => {
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowRight')
      expect(useTimelineStore.getState().playheadPosition).toBe(15000 + FRAME_MS)
    })

    it('ArrowLeft steps back 1 frame', () => {
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowLeft')
      expect(useTimelineStore.getState().playheadPosition).toBe(15000 - FRAME_MS)
    })

    it('ArrowLeft clamps at 0', () => {
      useTimelineStore.setState({ playheadPosition: 30 })
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowLeft')
      expect(useTimelineStore.getState().playheadPosition).toBe(0)
    })

    it('ArrowRight clamps at duration', () => {
      useTimelineStore.setState({ playheadPosition: 34990 })
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowRight')
      expect(useTimelineStore.getState().playheadPosition).toBe(35000)
    })

    it('stops playback when stepping', () => {
      useTimelineStore.setState({ isPlaying: true })
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowRight')
      expect(useTimelineStore.getState().isPlaying).toBe(false)
    })
  })

  describe('ArrowUp/Down — clip boundary jumping', () => {
    it('ArrowDown jumps to the next segment boundary', () => {
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowDown')
      expect(useTimelineStore.getState().playheadPosition).toBe(20000)
    })

    it('ArrowUp jumps to the previous segment boundary', () => {
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowUp')
      expect(useTimelineStore.getState().playheadPosition).toBe(10000)
    })

    it('ArrowDown does nothing at last boundary', () => {
      useTimelineStore.setState({ playheadPosition: 35000 })
      const { container } = renderTimeline()
      fireTimelineKey(container, 'ArrowDown')
      expect(useTimelineStore.getState().playheadPosition).toBe(35000)
    })
  })

  describe('J/K/L — variable-speed transport', () => {
    it('L starts playback at 1×', () => {
      const { container } = renderTimeline()
      fireTimelineKey(container, 'l')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(true)
      expect(s.playbackRate).toBe(1)
    })

    it('L while playing doubles rate', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: 1 })
      const { container } = renderTimeline()
      fireTimelineKey(container, 'l')
      expect(useTimelineStore.getState().playbackRate).toBe(2)
    })

    it('K stops playback', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: 4 })
      const { container } = renderTimeline()
      fireTimelineKey(container, 'k')
      expect(useTimelineStore.getState().isPlaying).toBe(false)
      expect(useTimelineStore.getState().playbackRate).toBe(1)
    })

    it('J starts reverse playback', () => {
      const { container } = renderTimeline()
      fireTimelineKey(container, 'j')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(true)
      expect(s.playbackRate).toBe(-1)
    })
  })

  describe('Scoping — keys do NOT fire without focus', () => {
    it('ArrowRight on window does NOT advance frame', () => {
      renderTimeline()
      // Fire on window, not on the timeline container
      fireWindowKey('ArrowRight')
      // Position should be unchanged
      expect(useTimelineStore.getState().playheadPosition).toBe(15000)
    })
  })
})
