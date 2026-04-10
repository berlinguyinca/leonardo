// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useLibraryStore } from '@renderer/stores/library-store'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { TrackLane } from '@renderer/components/timeline/TrackLane'
import type { Clip } from '@shared/types/events'
import type { Track, SyncPoint } from '@shared/types'

vi.mock('@renderer/components/timeline/TrackHeader', () => ({ TrackHeader: () => null }))
vi.mock('@renderer/components/timeline/Segment', () => ({ Segment: () => null }))
vi.mock('@renderer/components/timeline/SyncPointMarker', () => ({ SyncPointMarker: () => null }))

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/recordings/clip-1/recording.webm',
    duration: 5000,
    url: 'https://example.com/page',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-04-10T12:00:00Z',
    label: 'Test Clip',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments: [],
    zOrder: 0,
    label: 'Track 1',
    muted: false,
    locked: false,
    ...overrides,
  }
}

const defaultProps = {
  track: makeTrack(),
  syncPoints: [] as SyncPoint[],
  zoomLevel: 1,
  scrollOffset: 0,
  onToggleMute: vi.fn(),
  onToggleLock: vi.fn(),
}

/**
 * Dispatch a drop event using a raw MouseEvent so clientX is available
 * inside React's synthetic event handler (fireEvent.drop doesn't carry clientX
 * because jsdom's DragEvent constructor doesn't support it).
 */
function dispatchDropEvent(
  el: Element,
  clientX: number,
  getData: (type: string) => string,
): MouseEvent {
  const mockDataTransfer = { getData, dropEffect: '' }
  const evt = Object.assign(
    new MouseEvent('drop', { clientX, bubbles: true, cancelable: true }),
    { dataTransfer: mockDataTransfer },
  )
  el.dispatchEvent(evt)
  return evt
}

/**
 * Dispatch a dragover event with an attached mock dataTransfer.
 * Returns the native event so callers can check defaultPrevented.
 */
function dispatchDragOverEvent(el: Element): MouseEvent & { dataTransfer: { dropEffect: string } } {
  const mockDataTransfer = { dropEffect: '' }
  const evt = Object.assign(
    new MouseEvent('dragover', { bubbles: true, cancelable: true }),
    { dataTransfer: mockDataTransfer },
  )
  el.dispatchEvent(evt)
  return evt as MouseEvent & { dataTransfer: { dropEffect: string } }
}

describe('TrackLane drop target (integration)', () => {
  let addClipToTimelineMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addClipToTimelineMock = vi.fn()
    useTimelineStore.setState({ addClipToTimeline: addClipToTimelineMock } as any)
    useLibraryStore.setState({ clips: [], highlightedClipId: null })
  })

  describe('onDragOver', () => {
    it('calls preventDefault on dragover so browser allows the drop', () => {
      const { container } = render(<TrackLane {...defaultProps} />)
      const trackContent = container.querySelector('.track-content')!

      const evt = dispatchDragOverEvent(trackContent)

      expect(evt.defaultPrevented).toBe(true)
    })

    it('sets dropEffect to "copy" on dragover', () => {
      const { container } = render(<TrackLane {...defaultProps} />)
      const trackContent = container.querySelector('.track-content')!

      const evt = dispatchDragOverEvent(trackContent)

      expect(evt.dataTransfer.dropEffect).toBe('copy')
    })
  })

  describe('onDrop', () => {
    it('calls addClipToTimeline with the dropped clip and calculated insert time', () => {
      const clip = makeClip({ id: 'clip-abc' })
      useLibraryStore.setState({ clips: [clip], highlightedClipId: null })

      const { container } = render(
        <TrackLane {...defaultProps} zoomLevel={1} scrollOffset={0} />,
      )
      const trackContent = container.querySelector('.track-content')!

      // Mock getBoundingClientRect to return left: 100
      Object.defineProperty(trackContent, 'getBoundingClientRect', {
        value: () => ({ left: 100, top: 0, right: 500, bottom: 60, width: 400, height: 60 }),
        configurable: true,
      })

      // clientX = 300, rect.left = 100 → px = 200
      // pixelToTime(200, 1, 0) = (200 + 0) / (100 * 1) * 1000 = 2000ms
      dispatchDropEvent(trackContent, 300, (type) =>
        type === 'application/clip-id' ? 'clip-abc' : '',
      )

      expect(addClipToTimelineMock).toHaveBeenCalledOnce()
      expect(addClipToTimelineMock).toHaveBeenCalledWith(clip, 2000)
    })

    it('respects zoomLevel in insert time calculation', () => {
      const clip = makeClip({ id: 'clip-zoom' })
      useLibraryStore.setState({ clips: [clip], highlightedClipId: null })

      const { container } = render(
        <TrackLane {...defaultProps} zoomLevel={2} scrollOffset={0} />,
      )
      const trackContent = container.querySelector('.track-content')!

      Object.defineProperty(trackContent, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 400, bottom: 60, width: 400, height: 60 }),
        configurable: true,
      })

      // clientX = 200, rect.left = 0 → px = 200
      // pixelToTime(200, 2, 0) = (200 + 0) / (100 * 2) * 1000 = 1000ms
      dispatchDropEvent(trackContent, 200, (type) =>
        type === 'application/clip-id' ? 'clip-zoom' : '',
      )

      expect(addClipToTimelineMock).toHaveBeenCalledWith(clip, 1000)
    })

    it('respects scrollOffset in insert time calculation', () => {
      const clip = makeClip({ id: 'clip-scroll' })
      useLibraryStore.setState({ clips: [clip], highlightedClipId: null })

      const { container } = render(
        <TrackLane {...defaultProps} zoomLevel={1} scrollOffset={500} />,
      )
      const trackContent = container.querySelector('.track-content')!

      Object.defineProperty(trackContent, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 400, bottom: 60, width: 400, height: 60 }),
        configurable: true,
      })

      // clientX = 100, rect.left = 0 → px = 100
      // pixelToTime(100, 1, 500) = (100 + 500) / (100 * 1) * 1000 = 6000ms
      dispatchDropEvent(trackContent, 100, (type) =>
        type === 'application/clip-id' ? 'clip-scroll' : '',
      )

      expect(addClipToTimelineMock).toHaveBeenCalledWith(clip, 6000)
    })

    it('does NOT call addClipToTimeline when clip ID is not in library', () => {
      useLibraryStore.setState({ clips: [], highlightedClipId: null })

      const { container } = render(<TrackLane {...defaultProps} />)
      const trackContent = container.querySelector('.track-content')!

      Object.defineProperty(trackContent, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 400, bottom: 60, width: 400, height: 60 }),
        configurable: true,
      })

      dispatchDropEvent(trackContent, 200, (type) =>
        type === 'application/clip-id' ? 'nonexistent-id' : '',
      )

      expect(addClipToTimelineMock).not.toHaveBeenCalled()
    })

    it('does NOT call addClipToTimeline when dataTransfer has empty clip ID', () => {
      const clip = makeClip()
      useLibraryStore.setState({ clips: [clip], highlightedClipId: null })

      const { container } = render(<TrackLane {...defaultProps} />)
      const trackContent = container.querySelector('.track-content')!

      Object.defineProperty(trackContent, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 400, bottom: 60, width: 400, height: 60 }),
        configurable: true,
      })

      dispatchDropEvent(trackContent, 200, () => '')

      expect(addClipToTimelineMock).not.toHaveBeenCalled()
    })
  })
})
