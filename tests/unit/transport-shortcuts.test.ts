// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'

// Mount the keyboard listener by importing the hook and calling it
import { renderHook } from '@testing-library/react'
import { useUndoRedo } from '../../src/renderer/hooks/useUndoRedo'

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

function makeTimeline(tracks: Track[], duration = 60000): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks,
    syncPoints: [],
    duration,
    reviewed: false,
  }
}

function fireKey(key: string, opts: { shiftKey?: boolean; metaKey?: boolean } = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

describe('DaVinci Resolve keyboard shortcuts', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: makeTimeline([makeTrack([makeSegment({ startTime: 10000, endTime: 20000 })])]),
      playheadPosition: 15000,
      isPlaying: false,
      playbackRate: 1,
    })
    renderHook(() => useUndoRedo())
  })

  describe('L key — forward playback', () => {
    it('first L press starts playback at 1×', () => {
      useTimelineStore.setState({ isPlaying: false, playbackRate: 1 })
      fireKey('l')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(true)
      expect(s.playbackRate).toBe(1)
    })

    it('L while playing at 1× doubles to 2×', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: 1 })
      fireKey('l')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(true)
      expect(s.playbackRate).toBe(2)
    })

    it('L while playing at 2× doubles to 4×', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: 2 })
      fireKey('l')
      expect(useTimelineStore.getState().playbackRate).toBe(4)
    })

    it('L caps at 8×', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: 8 })
      fireKey('l')
      expect(useTimelineStore.getState().playbackRate).toBe(8)
    })
  })

  describe('K key — stop', () => {
    it('K stops playback and resets rate to 1', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: 4 })
      fireKey('k')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(false)
      expect(s.playbackRate).toBe(1)
    })
  })

  describe('J key — reverse playback', () => {
    it('first J press starts reverse playback at -1×', () => {
      useTimelineStore.setState({ isPlaying: false, playbackRate: 1 })
      fireKey('j')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(true)
      expect(s.playbackRate).toBe(-1)
    })

    it('J while playing at -1× doubles to -2×', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: -1 })
      fireKey('j')
      expect(useTimelineStore.getState().playbackRate).toBe(-2)
    })

    it('J caps at -8×', () => {
      useTimelineStore.setState({ isPlaying: true, playbackRate: -8 })
      fireKey('j')
      expect(useTimelineStore.getState().playbackRate).toBe(-8)
    })
  })

  describe('ArrowRight/Left — 5s stepping', () => {
    it('ArrowRight steps forward 5s and stops playback', () => {
      useTimelineStore.setState({ playheadPosition: 15000, isPlaying: true })
      fireKey('ArrowRight')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(false)
      expect(s.playheadPosition).toBe(20000)
    })

    it('ArrowLeft steps back 5s and stops playback', () => {
      useTimelineStore.setState({ playheadPosition: 15000, isPlaying: true })
      fireKey('ArrowLeft')
      const s = useTimelineStore.getState()
      expect(s.isPlaying).toBe(false)
      expect(s.playheadPosition).toBe(10000)
    })

    it('ArrowLeft clamps at 0', () => {
      useTimelineStore.setState({ playheadPosition: 2000 })
      fireKey('ArrowLeft')
      expect(useTimelineStore.getState().playheadPosition).toBe(0)
    })

    it('ArrowRight clamps at duration', () => {
      useTimelineStore.setState({ playheadPosition: 58000 })
      fireKey('ArrowRight')
      expect(useTimelineStore.getState().playheadPosition).toBe(60000)
    })
  })

  describe('Shift+Arrow — segment boundary jumping', () => {
    it('Shift+ArrowRight jumps to the next segment boundary', () => {
      // segment from 10000 to 20000; playhead at 15000 → next boundary is 20000
      useTimelineStore.setState({ playheadPosition: 15000 })
      fireKey('ArrowRight', { shiftKey: true })
      expect(useTimelineStore.getState().playheadPosition).toBe(20000)
    })

    it('Shift+ArrowLeft jumps to the previous segment boundary', () => {
      // segment from 10000 to 20000; playhead at 15000 → prev boundary is 10000
      useTimelineStore.setState({ playheadPosition: 15000 })
      fireKey('ArrowLeft', { shiftKey: true })
      expect(useTimelineStore.getState().playheadPosition).toBe(10000)
    })

    it('Shift+ArrowRight does nothing when already at last boundary', () => {
      useTimelineStore.setState({ playheadPosition: 20000 })
      fireKey('ArrowRight', { shiftKey: true })
      // no boundary after 20000 → position unchanged
      expect(useTimelineStore.getState().playheadPosition).toBe(20000)
    })
  })
})
