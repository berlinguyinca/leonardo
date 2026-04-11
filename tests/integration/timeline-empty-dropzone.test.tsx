// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { useLibraryStore } from '@renderer/stores/library-store'
import { Timeline } from '@renderer/components/timeline/Timeline'
import type { Clip } from '@shared/types/events'

// Mock sub-components and hooks not under test
vi.mock('@renderer/components/timeline/TimeRuler', () => ({ TimeRuler: () => null }))
vi.mock('@renderer/components/timeline/Playhead', () => ({ Playhead: () => null }))
vi.mock('@renderer/components/timeline/TrackLane', () => ({ TrackLane: () => null }))
vi.mock('@renderer/components/timeline/ScrollContainer', () => ({
  ScrollContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@renderer/components/timeline/ZoomControls', () => ({ ZoomControls: () => null }))
vi.mock('@renderer/hooks/usePlayhead', () => ({ usePlayhead: () => ({ seekTo: vi.fn() }) }))
vi.mock('@renderer/hooks/useTimelineZoom', () => ({
  useTimelineZoom: () => ({ zoom: vi.fn(), handleWheel: vi.fn() }),
}))

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/recordings/clip-1/recording.webm',
    duration: 5000,
    url: 'https://example.com',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-04-10T12:00:00Z',
    label: 'Test Clip',
    ...overrides,
  }
}

function dispatchDropEvent(el: Element, clipId: string): void {
  const mockDataTransfer = {
    getData: (type: string) => (type === 'application/clip-id' ? clipId : ''),
    dropEffect: '',
  }
  const evt = Object.assign(
    new MouseEvent('drop', { bubbles: true, cancelable: true }),
    { dataTransfer: mockDataTransfer },
  )
  el.dispatchEvent(evt)
}

function dispatchDragOverEvent(el: Element): MouseEvent {
  const mockDataTransfer = { dropEffect: '' }
  const evt = Object.assign(
    new MouseEvent('dragover', { bubbles: true, cancelable: true }),
    { dataTransfer: mockDataTransfer },
  )
  el.dispatchEvent(evt)
  return evt
}

describe('Timeline empty drop zone', () => {
  let addClipToTimelineMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addClipToTimelineMock = vi.fn()
    useTimelineStore.setState({ timeline: null, addClipToTimeline: addClipToTimelineMock } as any)
    useLibraryStore.setState({ clips: [], highlightedClipId: null })
  })

  it('renders drop zone hint text when timeline is null', () => {
    render(<Timeline />)
    expect(screen.getByText('Drop clips here or double-click a clip to start')).toBeDefined()
  })

  it('has timeline-empty-dropzone CSS class', () => {
    const { container } = render(<Timeline />)
    expect(container.querySelector('.timeline-empty-dropzone')).not.toBeNull()
  })

  it('dragover prevents default to allow drop', () => {
    const { container } = render(<Timeline />)
    const dropzone = container.querySelector('.timeline-empty-dropzone')!

    const evt = dispatchDragOverEvent(dropzone)

    expect(evt.defaultPrevented).toBe(true)
  })

  it('drop with valid clip-id calls addClipToTimeline with the clip', () => {
    const clip = makeClip()
    useLibraryStore.setState({ clips: [clip], highlightedClipId: null })

    const { container } = render(<Timeline />)
    const dropzone = container.querySelector('.timeline-empty-dropzone')!

    act(() => {
      dispatchDropEvent(dropzone, clip.id)
    })

    expect(addClipToTimelineMock).toHaveBeenCalledOnce()
    expect(addClipToTimelineMock).toHaveBeenCalledWith(clip)
  })

  it('drop with unknown clip-id does not call addClipToTimeline', () => {
    useLibraryStore.setState({ clips: [], highlightedClipId: null })

    const { container } = render(<Timeline />)
    const dropzone = container.querySelector('.timeline-empty-dropzone')!

    act(() => {
      dispatchDropEvent(dropzone, 'nonexistent-id')
    })

    expect(addClipToTimelineMock).not.toHaveBeenCalled()
  })

  it('adds drag-over class on dragover and removes on dragleave', async () => {
    const { container } = render(<Timeline />)
    const dropzone = container.querySelector('.timeline-empty-dropzone')!

    // dragover → drag-over class added
    await act(async () => {
      dispatchDragOverEvent(dropzone)
    })
    expect(dropzone.classList.contains('drag-over')).toBe(true)

    // dragleave → drag-over class removed
    await act(async () => {
      fireEvent.dragLeave(dropzone)
    })
    expect(dropzone.classList.contains('drag-over')).toBe(false)
  })
})
