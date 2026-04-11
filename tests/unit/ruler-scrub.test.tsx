// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { TimeRuler } from '../../src/renderer/components/timeline/TimeRuler'
import type { SyncTimeline } from '@shared/types'

function makeTimeline(): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [],
    syncPoints: [],
    duration: 30000,
    reviewed: false,
  }
}

describe('TimeRuler drag-to-scrub', () => {
  let onSeek: ReturnType<typeof vi.fn>

  beforeEach(() => {
    useTimelineStore.setState({ timeline: makeTimeline(), zoomLevel: 1 })
    onSeek = vi.fn()
  })

  function renderRuler() {
    const { container } = render(
      <TimeRuler scrollOffset={0} visibleWidth={800} onSeek={onSeek} />,
    )
    return container.querySelector('.time-ruler')!
  }

  it('calls onSeek on mousedown', () => {
    const el = renderRuler()
    fireEvent.mouseDown(el, { clientX: 100, bubbles: true })
    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(typeof onSeek.mock.calls[0][0]).toBe('number')
    expect(onSeek.mock.calls[0][0]).toBeGreaterThanOrEqual(0)
  })

  it('calls onSeek again on mousemove after mousedown', () => {
    const el = renderRuler()
    fireEvent.mouseDown(el, { clientX: 100, bubbles: true })
    fireEvent.mouseMove(document, { clientX: 200, bubbles: true })
    expect(onSeek).toHaveBeenCalledTimes(2)
  })

  it('does not call onSeek on mousemove without prior mousedown', () => {
    renderRuler()
    fireEvent.mouseMove(document, { clientX: 200, bubbles: true })
    expect(onSeek).not.toHaveBeenCalled()
  })

  it('stops calling onSeek on mousemove after mouseup', () => {
    const el = renderRuler()
    fireEvent.mouseDown(el, { clientX: 100, bubbles: true })
    fireEvent.mouseUp(document, { bubbles: true })
    onSeek.mockClear()
    fireEvent.mouseMove(document, { clientX: 300, bubbles: true })
    expect(onSeek).not.toHaveBeenCalled()
  })
})
