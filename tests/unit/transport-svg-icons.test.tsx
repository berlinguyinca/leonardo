// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { TransportControls } from '@renderer/components/timeline/TransportControls'
import type { SyncTimeline } from '@shared/types'

function makeTimeline(duration = 60000): SyncTimeline {
  return { id: 'tl-1', projectId: 'p-1', tracks: [], syncPoints: [], duration, reviewed: false }
}

describe('TransportControls — SVG icons', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: makeTimeline(),
      playheadPosition: 0,
      isPlaying: false,
      playbackRate: 1,
    })
    ;(window as Record<string, unknown>).leonardo = { clip: { getThumbnails: async () => [] } }
  })

  it('renders no emoji characters in button content', () => {
    const { container } = render(<TransportControls />)
    const buttons = container.querySelectorAll('button')
    buttons.forEach((btn) => {
      const text = btn.textContent ?? ''
      expect(text).not.toMatch(/[⏮⏪▶⏸⏩⏭▶️⏸️]/)
    })
  })

  it('renders SVG elements inside transport buttons', () => {
    const { container } = render(<TransportControls />)
    const svgs = container.querySelectorAll('.transport-btn svg, .transport-btn-play svg')
    expect(svgs.length).toBeGreaterThanOrEqual(5)
  })

  it('play button has transport-btn-play class', () => {
    const { container } = render(<TransportControls />)
    const playBtn = container.querySelector('.transport-btn-play')
    expect(playBtn).not.toBeNull()
  })

  it('clicking play toggles isPlaying', () => {
    const { container } = render(<TransportControls />)
    const playBtn = container.querySelector('.transport-btn-play') as HTMLElement
    fireEvent.click(playBtn)
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })

  it('timecode is rendered with transport-time class', () => {
    const { container } = render(<TransportControls />)
    expect(container.querySelector('.transport-time')).not.toBeNull()
  })
})
