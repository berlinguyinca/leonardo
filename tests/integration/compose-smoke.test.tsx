// @vitest-environment jsdom
/**
 * Smoke tests for the compose view.
 * Mounts real component trees to verify panels render, frame counter shows,
 * and keyboard shortcuts are correctly scoped.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import { useUIStore } from '../../src/renderer/stores/ui-store'
import type { SyncTimeline, Segment, Clip } from '@shared/types'

// Stub media element methods (jsdom doesn't support media)
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  ;(window as Record<string, unknown>).leonardo = {
    clip: { getThumbnails: async () => [] },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

// --- Helpers ---

function makeSegment(overrides?: Partial<Segment>): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/video-a.mp4',
    sourceOffset: 0,
    label: 'Clip A',
    ...overrides,
  }
}

function seedStores() {
  const timeline: SyncTimeline = {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [{
      id: 'track-1',
      type: 'clip',
      segments: [
        makeSegment({ id: 'seg-1', startTime: 0, endTime: 5000, sourceFile: '/video-a.mp4' }),
        makeSegment({ id: 'seg-2', startTime: 5000, endTime: 10000, sourceFile: '/video-b.mp4' }),
      ],
      zOrder: 0, label: 'Video', muted: false, locked: false,
    }],
    syncPoints: [],
    duration: 10000,
    reviewed: false,
  }

  const clips: Clip[] = [
    { id: 'c-a', projectId: 'p-1', filePath: '/video-a.mp4', duration: 5000, url: '', resolution: { width: 1920, height: 1080 }, createdAt: '', label: 'A' },
    { id: 'c-b', projectId: 'p-1', filePath: '/video-b.mp4', duration: 5000, url: '', resolution: { width: 1920, height: 1080 }, createdAt: '', label: 'B' },
  ]

  useTimelineStore.setState({
    timeline,
    playheadPosition: 1000,
    isPlaying: false,
    playbackRate: 1,
    selectedSegmentId: null,
  })
  useLibraryStore.setState({ clips })
  useUIStore.setState({
    editorView: 'inline',
    timelineCollapsed: false,
    sidebarCollapsed: true,
    propertiesCollapsed: true,
  })
}

// --- Imports (after stubs) ---
import { Timeline } from '../../src/renderer/components/timeline/Timeline'
import { TransportControls } from '../../src/renderer/components/timeline/TransportControls'
import { PlaybackPanel } from '../../src/renderer/components/preview/PlaybackPanel'

// Global shortcuts hook
import { renderHook } from '@testing-library/react'
import { useUndoRedo } from '../../src/renderer/hooks/useUndoRedo'

const FRAME_MS = Math.round(1000 / 15)

describe('Compose view — smoke tests', () => {
  beforeEach(() => {
    seedStores()
  })

  it('PlaybackPanel renders video element when timeline has segments', () => {
    const { container } = render(<PlaybackPanel />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toContain('media://')
  })

  it('Timeline renders with track lanes when timeline exists', () => {
    const { container } = render(<Timeline />)
    expect(container.querySelector('.timeline-container')).not.toBeNull()
    expect(container.querySelector('.timeline-header')).not.toBeNull()
  })

  it('TransportControls shows frame counter', () => {
    const { container } = render(<TransportControls seekTo={() => {}} />)
    const frameEl = container.querySelector('.transport-frame')
    expect(frameEl).not.toBeNull()
    expect(frameEl?.textContent).toMatch(/Frame \d+ \/ \d+/)
  })

  it('frame counter shows correct values for position and duration', () => {
    useTimelineStore.setState({ playheadPosition: 2000 })
    const { container } = render(<TransportControls seekTo={() => {}} />)
    const frameEl = container.querySelector('.transport-frame')
    const expectedFrame = Math.floor(2000 / FRAME_MS) + 1
    const expectedTotal = Math.ceil(10000 / FRAME_MS)
    expect(frameEl?.textContent).toBe(`Frame ${expectedFrame} / ${expectedTotal}`)
  })

  describe('Keyboard scoping', () => {
    it('ArrowRight on timeline container advances by 1 frame', () => {
      const { container } = render(<Timeline />)
      const timelineEl = container.querySelector('.timeline-container') as HTMLElement
      timelineEl.focus()
      fireEvent.keyDown(timelineEl, { key: 'ArrowRight' })
      expect(useTimelineStore.getState().playheadPosition).toBe(1000 + FRAME_MS)
    })

    it('ArrowRight on window does NOT advance position', () => {
      render(<Timeline />)
      // Mount global shortcuts
      renderHook(() => useUndoRedo())

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      // Position should be unchanged ��� ArrowRight is timeline-scoped
      expect(useTimelineStore.getState().playheadPosition).toBe(1000)
    })

    it('Space on window toggles play/pause globally', () => {
      render(<Timeline />)
      renderHook(() => useUndoRedo())

      expect(useTimelineStore.getState().isPlaying).toBe(false)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      })
      expect(useTimelineStore.getState().isPlaying).toBe(true)
    })

    it('ArrowDown on timeline jumps to next segment boundary', () => {
      const { container } = render(<Timeline />)
      const timelineEl = container.querySelector('.timeline-container') as HTMLElement
      timelineEl.focus()
      fireEvent.keyDown(timelineEl, { key: 'ArrowDown' })
      expect(useTimelineStore.getState().playheadPosition).toBe(5000)
    })
  })
})
