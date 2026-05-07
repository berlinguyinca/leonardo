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

  const noopSeek = () => {}

  it('renders no emoji characters in button content', () => {
    const { container } = render(<TransportControls seekTo={noopSeek} />)
    const buttons = container.querySelectorAll('button')
    buttons.forEach((btn) => {
      const text = btn.textContent ?? ''
      expect(text).not.toMatch(/[⏮⏪▶⏸⏩⏭▶️⏸️]/)
    })
  })

  it('renders SVG elements inside transport buttons', () => {
    const { container } = render(<TransportControls seekTo={noopSeek} />)
    const svgs = container.querySelectorAll('.transport-btn svg, .transport-btn-play svg')
    expect(svgs.length).toBeGreaterThanOrEqual(5)
  })

  it('play button has transport-btn-play class', () => {
    const { container } = render(<TransportControls seekTo={noopSeek} />)
    const playBtn = container.querySelector('.transport-btn-play')
    expect(playBtn).not.toBeNull()
  })

  it('clicking play toggles isPlaying', () => {
    const { container } = render(<TransportControls seekTo={noopSeek} />)
    const playBtn = container.querySelector('.transport-btn-play') as HTMLElement
    fireEvent.click(playBtn)
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })

  it('timecode is rendered with transport-time class', () => {
    const { container } = render(<TransportControls seekTo={noopSeek} />)
    expect(container.querySelector('.transport-time')).not.toBeNull()
  })

  it('frame counter displays correct frame number', () => {
    const FRAME_MS = Math.round(1000 / 15)
    useTimelineStore.setState({ playheadPosition: 2000, timeline: makeTimeline(10000) })
    const { container } = render(<TransportControls seekTo={noopSeek} />)
    const frameSpan = container.querySelector('.transport-frame')
    expect(frameSpan).not.toBeNull()
    const expectedFrame = Math.floor(2000 / FRAME_MS) + 1
    const expectedTotal = Math.ceil(10000 / FRAME_MS)
    expect(frameSpan?.textContent).toBe(`Frame ${expectedFrame} / ${expectedTotal}`)
  })

  it('frame counter shows Frame 1 at position 0', () => {
    useTimelineStore.setState({ playheadPosition: 0, timeline: makeTimeline(5000) })
    const { container } = render(<TransportControls seekTo={noopSeek} />)
    const frameSpan = container.querySelector('.transport-frame')
    expect(frameSpan?.textContent).toMatch(/^Frame 1 \//)
  })
})
