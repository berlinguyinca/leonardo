// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'

describe('timeline-store: playbackRate', () => {
  beforeEach(() => {
    useTimelineStore.setState({ playbackRate: 1, isPlaying: false })
  })

  it('defaults to playbackRate 1', () => {
    const state = useTimelineStore.getState()
    expect(state.playbackRate).toBe(1)
  })

  it('setPlaybackRate stores the given rate', () => {
    useTimelineStore.getState().setPlaybackRate(-2)
    expect(useTimelineStore.getState().playbackRate).toBe(-2)
  })

  it('setPlaybackRate can store fractional rates', () => {
    useTimelineStore.getState().setPlaybackRate(0.5)
    expect(useTimelineStore.getState().playbackRate).toBe(0.5)
  })

  it('setPlaybackRate can store positive rates up to 8', () => {
    useTimelineStore.getState().setPlaybackRate(8)
    expect(useTimelineStore.getState().playbackRate).toBe(8)
  })
})
