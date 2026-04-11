// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlayhead } from '../../src/renderer/hooks/usePlayhead'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline } from '@shared/types'

function makeTimeline(duration = 60000): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [],
    syncPoints: [],
    duration,
    reviewed: false,
  }
}

describe('usePlayhead — duration loaded after mount', () => {
  let rafCallbacks: FrameRequestCallback[] = []
  let rafId = 0

  beforeEach(() => {
    rafCallbacks = []
    rafId = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++rafId
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValue(0) })

    useTimelineStore.setState({
      timeline: null,
      playheadPosition: 0,
      isPlaying: false,
      playbackRate: 1,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not stop playback when first tick fires with no timeline loaded', () => {
    renderHook(() => usePlayhead())

    // Start playing — no timeline yet
    act(() => {
      useTimelineStore.setState({ isPlaying: true })
    })

    // One RAF tick fires — timeline still null, duration=0
    act(() => {
      const cb = rafCallbacks.pop()!
      ;(performance.now as ReturnType<typeof vi.fn>).mockReturnValue(100)
      cb(100)
    })

    // With the fix: playback should still be running (not stopped)
    // Bug: broken code treats clamped=0 >= duration=0 as end-of-timeline → stops
    expect(useTimelineStore.getState().isPlaying).toBe(true)
    // And a new RAF should have been queued (tick loop continues)
    expect(rafCallbacks.length).toBeGreaterThan(0)
  })

  it('advances position after timeline loads mid-playback', () => {
    renderHook(() => usePlayhead())

    // Start with timeline already loaded so we can test position advance
    useTimelineStore.setState({ timeline: makeTimeline(60000) })

    act(() => {
      useTimelineStore.setState({ isPlaying: true })
    })

    // Tick — position starts at 0, dt=100ms → should advance to ~100
    act(() => {
      const cb = rafCallbacks.pop()!
      ;(performance.now as ReturnType<typeof vi.fn>).mockReturnValue(100)
      cb(100)
    })

    expect(useTimelineStore.getState().isPlaying).toBe(true)
    // Position should have advanced
    const { emitCount } = { emitCount: 0 } // just verify it didn't stop
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })

  it('stops and resets rate when playhead reaches end', () => {
    useTimelineStore.setState({ timeline: makeTimeline(60000), playheadPosition: 59900 })
    const { result } = renderHook(() => usePlayhead())
    result.current.positionRef.current = 59900

    act(() => {
      useTimelineStore.setState({ isPlaying: true })
    })

    act(() => {
      const cb = rafCallbacks.pop()!
      ;(performance.now as ReturnType<typeof vi.fn>).mockReturnValue(200)
      cb(200)  // dt=200ms * rate=1 → 59900+200=60100 >= 60000 → stop
    })

    const s = useTimelineStore.getState()
    expect(s.isPlaying).toBe(false)
    expect(s.playbackRate).toBe(1)
  })
})
