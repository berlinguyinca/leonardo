// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'
import { defaultOverlayMetadata } from '@shared/types'

// Mock heavy sub-components so we can test overlay rendering in isolation
vi.mock('../../src/renderer/components/timeline/ThumbnailStrip', () => ({
  ThumbnailStrip: () => null,
}))
vi.mock('../../src/renderer/components/timeline/SegmentContextMenu', () => ({
  SegmentContextMenu: () => null,
}))
vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: { clips: never[] }) => unknown) => selector({ clips: [] }),
}))
vi.mock('../../src/renderer/stores/script-store', () => ({
  useScriptStore: (selector: (s: { clipScripts: Record<string, never[]> }) => unknown) =>
    selector({ clipScripts: {} }),
}))

// Import after mocks
import { Segment as SegmentComponent } from '../../src/renderer/components/timeline/Segment'
import { OverlayToolbar } from '../../src/renderer/components/effects/OverlayToolbar'

// ---- helpers ----

function makeOverlaySegment(overlayType: 'intro' | 'exit' | 'title' | 'section', overrides?: Partial<Segment>): Segment {
  return {
    id: `seg-${overlayType}`,
    trackId: 'track-overlay',
    startTime: 0,
    endTime: 3000,
    sourceFile: '',
    sourceOffset: 0,
    label: overlayType,
    metadata: JSON.stringify(defaultOverlayMetadata(overlayType)),
    ...overrides,
  }
}

function makeOverlayTrack(segments: Segment[]): Track {
  return {
    id: 'track-overlay',
    type: 'overlay',
    segments,
    zOrder: 10,
    label: 'Overlays',
    muted: false,
    locked: false,
  }
}

function makeTimeline(tracks: Track[]): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'proj-1',
    tracks,
    syncPoints: [],
    duration: 10000,
    reviewed: false,
  }
}

// ---- tests ----

describe('Overlay segment rendering', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: null, selectedSegmentId: null })
    ;(window as Record<string, unknown>).leonardo = {
      clip: { getThumbnails: async () => [] },
    }
  })

  it('renders intro segment with blue background', () => {
    const seg = makeOverlaySegment('intro')
    const { container } = render(
      <SegmentComponent segment={seg} trackType="overlay" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    const el = container.querySelector('.timeline-segment') as HTMLElement
    expect(el.style.backgroundColor).toBe('rgb(59, 130, 246)')
  })

  it('renders exit segment with red background', () => {
    const seg = makeOverlaySegment('exit')
    const { container } = render(
      <SegmentComponent segment={seg} trackType="overlay" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    const el = container.querySelector('.timeline-segment') as HTMLElement
    expect(el.style.backgroundColor).toBe('rgb(239, 68, 68)')
  })

  it('renders title segment with amber background', () => {
    const seg = makeOverlaySegment('title')
    const { container } = render(
      <SegmentComponent segment={seg} trackType="overlay" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    const el = container.querySelector('.timeline-segment') as HTMLElement
    expect(el.style.backgroundColor).toBe('rgb(245, 158, 11)')
  })

  it('renders section segment with purple background', () => {
    const seg = makeOverlaySegment('section')
    const { container } = render(
      <SegmentComponent segment={seg} trackType="overlay" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    const el = container.querySelector('.timeline-segment') as HTMLElement
    expect(el.style.backgroundColor).toBe('rgb(139, 92, 246)')
  })

  it('non-overlay segment has no overlay background color', () => {
    const seg: Segment = {
      id: 'seg-clip',
      trackId: 'track-1',
      startTime: 0,
      endTime: 5000,
      sourceFile: '/tmp/video.mp4',
      sourceOffset: 0,
      label: 'Clip',
    }
    const { container } = render(
      <SegmentComponent segment={seg} trackType="clip" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    const el = container.querySelector('.timeline-segment') as HTMLElement
    expect(el.style.backgroundColor).toBe('')
  })
})

describe('Overlay type badge', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: null, selectedSegmentId: null })
    ;(window as Record<string, unknown>).leonardo = {
      clip: { getThumbnails: async () => [] },
    }
  })

  it.each(['intro', 'exit', 'title', 'section'] as const)(
    'shows %s badge on overlay segment',
    (overlayType) => {
      const seg = makeOverlaySegment(overlayType)
      const { getByTestId } = render(
        <SegmentComponent segment={seg} trackType="overlay" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
      )
      const badge = getByTestId('overlay-type-badge')
      expect(badge.textContent).toBe(overlayType)
    },
  )

  it('does not render overlay badge on non-overlay segment', () => {
    const seg: Segment = {
      id: 'seg-clip',
      trackId: 'track-1',
      startTime: 0,
      endTime: 5000,
      sourceFile: '/tmp/video.mp4',
      sourceOffset: 0,
      label: 'Clip',
    }
    const { container } = render(
      <SegmentComponent segment={seg} trackType="clip" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    expect(container.querySelector('[data-testid="overlay-type-badge"]')).toBeNull()
  })
})

describe('OverlayToolbar — add overlay buttons', () => {
  beforeEach(() => {
    const track = makeOverlayTrack([])
    useTimelineStore.setState({ timeline: makeTimeline([track]), playheadPosition: 5000 })
    ;(window as Record<string, unknown>).leonardo = {
      timeline: { save: vi.fn() },
    }
  })

  it('renders all four add-overlay buttons', () => {
    const { getByTestId } = render(<OverlayToolbar />)
    const toolbar = getByTestId('overlay-toolbar')
    const buttons = toolbar.querySelectorAll('button')
    expect(buttons).toHaveLength(4)
  })

  it('Add Intro button creates an intro overlay segment at playhead', () => {
    const { getByTestId } = render(<OverlayToolbar />)
    const toolbar = getByTestId('overlay-toolbar')
    const introBtn = toolbar.querySelector('[data-overlay-type="intro"]') as HTMLElement
    fireEvent.click(introBtn)

    const state = useTimelineStore.getState()
    const overlayTrack = state.timeline?.tracks.find((t) => t.type === 'overlay')
    const seg = overlayTrack?.segments.find((s) => s.label === 'intro')
    expect(seg).toBeDefined()
    expect(seg?.startTime).toBe(5000)
    expect(seg?.endTime).toBe(8000)
  })

  it('Add Exit button creates an exit overlay segment', () => {
    const { getByTestId } = render(<OverlayToolbar />)
    const toolbar = getByTestId('overlay-toolbar')
    const exitBtn = toolbar.querySelector('[data-overlay-type="exit"]') as HTMLElement
    fireEvent.click(exitBtn)

    const state = useTimelineStore.getState()
    const overlayTrack = state.timeline?.tracks.find((t) => t.type === 'overlay')
    const seg = overlayTrack?.segments.find((s) => s.label === 'exit')
    expect(seg).toBeDefined()
  })

  it('Add Title button creates a title overlay segment', () => {
    const { getByTestId } = render(<OverlayToolbar />)
    const toolbar = getByTestId('overlay-toolbar')
    const titleBtn = toolbar.querySelector('[data-overlay-type="title"]') as HTMLElement
    fireEvent.click(titleBtn)

    const state = useTimelineStore.getState()
    const overlayTrack = state.timeline?.tracks.find((t) => t.type === 'overlay')
    const seg = overlayTrack?.segments.find((s) => s.label === 'title')
    expect(seg).toBeDefined()
  })

  it('Add Section button creates a section overlay segment', () => {
    const { getByTestId } = render(<OverlayToolbar />)
    const toolbar = getByTestId('overlay-toolbar')
    const sectionBtn = toolbar.querySelector('[data-overlay-type="section"]') as HTMLElement
    fireEvent.click(sectionBtn)

    const state = useTimelineStore.getState()
    const overlayTrack = state.timeline?.tracks.find((t) => t.type === 'overlay')
    const seg = overlayTrack?.segments.find((s) => s.label === 'section')
    expect(seg).toBeDefined()
  })
})

describe('Overlay segment draggable edges', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: null, selectedSegmentId: null })
    ;(window as Record<string, unknown>).leonardo = {
      clip: { getThumbnails: async () => [] },
    }
    // jsdom does not implement setPointerCapture — stub it to prevent unhandled errors
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  it('overlay segment left and right edges have pointer-down handlers', () => {
    const seg = makeOverlaySegment('intro')
    const { getByTestId } = render(
      <SegmentComponent segment={seg} trackType="overlay" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    const leftEdge = getByTestId('segment-edge-left')
    const rightEdge = getByTestId('segment-edge-right')
    expect(leftEdge).toBeInTheDocument()
    expect(rightEdge).toBeInTheDocument()
    // Overlay segments have the overlay-segment class
    expect(leftEdge.closest('.overlay-segment')).not.toBeNull()
    expect(rightEdge.closest('.overlay-segment')).not.toBeNull()
  })

  it('non-overlay segment timing is unchanged when edge receives a pointer event', () => {
    const seg: Segment = {
      id: 'seg-clip',
      trackId: 'track-1',
      startTime: 0,
      endTime: 5000,
      sourceFile: '/tmp/video.mp4',
      sourceOffset: 0,
      label: 'Clip',
    }
    const tl = makeTimeline([{
      id: 'track-1',
      type: 'clip',
      segments: [seg],
      zOrder: 0,
      label: 'Video',
      muted: false,
      locked: false,
    }])
    useTimelineStore.setState({ timeline: tl })

    const { getByTestId } = render(
      <SegmentComponent segment={seg} trackType="clip" zoomLevel={1} scrollOffset={0} snapTargets={[]} />,
    )
    // Firing pointer down on a non-overlay edge should not crash or update timing
    const leftEdge = getByTestId('segment-edge-left')
    fireEvent.pointerDown(leftEdge)
    // Timing unchanged
    const state = useTimelineStore.getState()
    const track = state.timeline?.tracks[0]
    const s = track?.segments[0]
    expect(s?.startTime).toBe(0)
    expect(s?.endTime).toBe(5000)
  })
})
