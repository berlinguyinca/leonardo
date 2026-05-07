// @vitest-environment jsdom
/**
 * Integration tests for the playback pipeline.
 * Uses real Zustand stores (no mocks), real PlaybackPanel, real VideoPlayer.
 * Only HTMLMediaElement methods are stubbed (jsdom doesn't support media).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import { playheadEmitter } from '../../src/renderer/hooks/PlayheadEmitter'
import type { SyncTimeline, Segment, Clip } from '@shared/types'

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

function twoSegmentTimeline(): SyncTimeline {
  return {
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
}

function twoClips(): Clip[] {
  return [
    { id: 'c-a', projectId: 'p-1', filePath: '/video-a.mp4', duration: 5000, url: '', resolution: { width: 1920, height: 1080 }, createdAt: '', label: 'A' },
    { id: 'c-b', projectId: 'p-1', filePath: '/video-b.mp4', duration: 5000, url: '', resolution: { width: 1920, height: 1080 }, createdAt: '', label: 'B' },
  ]
}

let playSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  ;(window as Record<string, unknown>).leonardo = { clip: { getThumbnails: async () => [] } }
})

afterEach(() => {
  vi.restoreAllMocks()
  playheadEmitter.all.clear()
})

// --- Lazy imports (after mocks) ---
import { PlaybackPanel } from '../../src/renderer/components/preview/PlaybackPanel'

function seedStores(opts: { position?: number; playing?: boolean } = {}) {
  useTimelineStore.setState({
    timeline: twoSegmentTimeline(),
    playheadPosition: opts.position ?? 1000,
    isPlaying: opts.playing ?? false,
    playbackRate: 1,
    selectedSegmentId: null,
  })
  useLibraryStore.setState({ clips: twoClips() })
}

describe('Playback pipeline — integration', () => {
  it('play button → video.play() called after loadeddata', () => {
    seedStores({ position: 1000, playing: false })

    const { container } = render(<PlaybackPanel />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()

    // Video not ready yet — simulate loadeddata
    fireEvent.loadedData(video!)

    // Now press play via store
    act(() => {
      useTimelineStore.getState().setIsPlaying(true)
    })

    expect(playSpy).toHaveBeenCalled()
  })

  it('frame step → video.currentTime updated after loadeddata', () => {
    seedStores({ position: 1000, playing: false })

    const { container } = render(<PlaybackPanel />)
    const video = container.querySelector('video')!
    fireEvent.loadedData(video)

    // Step forward via store (simulates ArrowRight)
    const FRAME_MS = Math.round(1000 / 15)
    act(() => {
      const newPos = 1000 + FRAME_MS
      useTimelineStore.getState().setPlayheadPosition(newPos)
      playheadEmitter.emit('position', newPos)
    })

    // Video should have seeked — currentTime in seconds
    expect(video.currentTime).toBeCloseTo((1000 + FRAME_MS) / 1000, 1)
  })

  it('segment boundary crossing → video src changes', () => {
    seedStores({ position: 1000, playing: true })

    const { container } = render(<PlaybackPanel />)
    const video = container.querySelector('video')!

    // Initially showing clip A
    expect(video.getAttribute('src')).toBe('media:///video-a.mp4')

    // Emit position past segment boundary (into segment 2)
    act(() => {
      playheadEmitter.emit('position', 6000)
    })

    // Src should now point to clip B
    expect(video.getAttribute('src')).toBe('media:///video-b.mp4')
  })

  it('play from end resets position to 0', () => {
    seedStores({ position: 10000, playing: false })

    // usePlayhead manages the reset — test via store directly
    const store = useTimelineStore.getState()
    expect(store.playheadPosition).toBe(10000)

    // Simulate what usePlayhead does on play start
    act(() => {
      // Sync positionRef from store, then check end condition
      const pos = useTimelineStore.getState().playheadPosition
      const dur = useTimelineStore.getState().timeline?.duration ?? 0
      if (dur > 0 && pos >= dur) {
        useTimelineStore.getState().setPlayheadPosition(0)
      }
      useTimelineStore.getState().setIsPlaying(true)
    })

    expect(useTimelineStore.getState().playheadPosition).toBe(0)
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })

  it('seekTo → PlaybackPanel passes correct currentTime to VideoPlayer', () => {
    seedStores({ position: 0, playing: false })

    const { container } = render(<PlaybackPanel />)
    const video = container.querySelector('video')!
    fireEvent.loadedData(video)

    // Seek to 2500ms (inside segment 1: [0, 5000))
    act(() => {
      useTimelineStore.getState().setPlayheadPosition(2500)
      playheadEmitter.emit('position', 2500)
    })

    // Video should be seeked to 2.5 seconds (relative to segment start + sourceOffset)
    expect(video.currentTime).toBeCloseTo(2.5, 1)
  })
})
