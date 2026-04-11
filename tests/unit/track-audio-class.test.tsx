// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TrackLane } from '@renderer/components/timeline/TrackLane'
import { useLibraryStore } from '@renderer/stores/library-store'
import type { Track } from '@shared/types'

const baseTrack: Track = {
  id: 'track-1',
  type: 'clip',
  segments: [],
  zOrder: 0,
  label: 'Video',
  muted: false,
  locked: false,
}

const audioTrack: Track = { ...baseTrack, id: 'track-2', type: 'audio', label: 'Audio' }

describe('TrackLane — audio class', () => {
  beforeEach(() => {
    useLibraryStore.setState({ clips: [] })
    ;(window as Record<string, unknown>).leonardo = undefined
  })

  it('does not add track-audio class for clip tracks', () => {
    const { container } = render(
      <TrackLane
        track={baseTrack}
        syncPoints={[]}
        zoomLevel={1}
        scrollOffset={0}
        onToggleMute={vi.fn()}
        onToggleLock={vi.fn()}
      />
    )
    const lane = container.querySelector('.track-lane')!
    expect(lane.classList.contains('track-audio')).toBe(false)
  })

  it('adds track-audio class for audio tracks', () => {
    const { container } = render(
      <TrackLane
        track={audioTrack}
        syncPoints={[]}
        zoomLevel={1}
        scrollOffset={0}
        onToggleMute={vi.fn()}
        onToggleLock={vi.fn()}
      />
    )
    const lane = container.querySelector('.track-lane')!
    expect(lane.classList.contains('track-audio')).toBe(true)
  })
})
