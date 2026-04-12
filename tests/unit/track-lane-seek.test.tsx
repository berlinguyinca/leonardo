// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import { TrackLane } from '../../src/renderer/components/timeline/TrackLane'
import type { Track } from '@shared/types'

function makeTrack(overrides?: Partial<Track>): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments: [],
    zOrder: 0,
    label: 'Video',
    muted: false,
    locked: false,
    ...overrides,
  }
}

describe('TrackLane click-to-seek', () => {
  let onSeek: ReturnType<typeof vi.fn>

  beforeEach(() => {
    useTimelineStore.setState({ zoomLevel: 1 })
    useLibraryStore.setState({ clips: [] })
    onSeek = vi.fn()
  })

  function renderTrackLane(trackOverrides?: Partial<Track>) {
    const { container } = render(
      <TrackLane
        track={makeTrack(trackOverrides)}
        syncPoints={[]}
        zoomLevel={1}
        scrollOffset={0}
        onToggleMute={() => {}}
        onToggleLock={() => {}}
        onSeek={onSeek}
      />,
    )
    return container.querySelector('.track-content')!
  }

  it('calls onSeek with correct time when clicking empty track area', () => {
    const el = renderTrackLane()
    // Mock getBoundingClientRect so left edge is at 0
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 800, bottom: 40,
      width: 800, height: 40, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.click(el, { clientX: 100 })
    expect(onSeek).toHaveBeenCalledTimes(1)
    // pixelToTime(100, 1, 0) = (100 / 100) * 1000 = 1000ms
    expect(onSeek).toHaveBeenCalledWith(1000)
  })

  it('does not call onSeek when track is locked', () => {
    const el = renderTrackLane({ locked: true })
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 800, bottom: 40,
      width: 800, height: 40, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.click(el, { clientX: 100 })
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('returns non-negative time for clicks at left edge', () => {
    const el = renderTrackLane()
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 50, top: 0, right: 850, bottom: 40,
      width: 800, height: 40, x: 50, y: 0, toJSON: () => {},
    })
    // Click at x=30, which is left of the element (negative offset)
    fireEvent.click(el, { clientX: 30 })
    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek.mock.calls[0][0]).toBeGreaterThanOrEqual(0)
  })

  it('accounts for scroll offset in time calculation', () => {
    const { container } = render(
      <TrackLane
        track={makeTrack()}
        syncPoints={[]}
        zoomLevel={1}
        scrollOffset={200}
        onToggleMute={() => {}}
        onToggleLock={() => {}}
        onSeek={onSeek}
      />,
    )
    const el = container.querySelector('.track-content')!
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 800, bottom: 40,
      width: 800, height: 40, x: 0, y: 0, toJSON: () => {},
    })
    fireEvent.click(el, { clientX: 100 })
    expect(onSeek).toHaveBeenCalledTimes(1)
    // pixelToTime(100, 1, 200) = ((100 + 200) / 100) * 1000 = 3000ms
    expect(onSeek).toHaveBeenCalledWith(3000)
  })
})
