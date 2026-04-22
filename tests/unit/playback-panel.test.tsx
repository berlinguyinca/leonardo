// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import type { SyncTimeline, Track, Segment, Clip } from '@shared/types'

function makeSegment(overrides?: Partial<Segment>): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/path/to/video.mp4',
    sourceOffset: 0,
    label: 'Intro',
    ...overrides,
  }
}

function makeTimeline(overrides?: Partial<SyncTimeline>): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [
      {
        id: 'track-1',
        type: 'clip',
        segments: [makeSegment()],
        zOrder: 0,
        label: 'Video',
        muted: false,
        locked: false,
      },
    ],
    syncPoints: [],
    duration: 5000,
    reviewed: false,
    ...overrides,
  }
}

function makeClip(overrides?: Partial<Clip>): Clip {
  return {
    id: 'clip-1',
    projectId: 'p-1',
    filePath: '/path/to/video.mp4',
    duration: 5000,
    url: 'https://example.com',
    resolution: { width: 1920, height: 1080 },
    createdAt: '2026-04-11T10:00:00Z',
    label: 'Recording 1',
    ...overrides,
  }
}

// Stub window.HTMLMediaElement.prototype methods for jsdom
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

import { PlaybackPanel } from '../../src/renderer/components/preview/PlaybackPanel'

describe('PlaybackPanel', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: null,
      playheadPosition: 0,
      isPlaying: false,
      playbackRate: 1,
      selectedSegmentId: null,
    })
    useLibraryStore.setState({ clips: [] })
  })

  it('shows placeholder when no timeline exists', () => {
    const { container } = render(<PlaybackPanel />)
    expect(container.textContent).toMatch(/no video/i)
    expect(container.querySelector('video')).toBeNull()
  })

  it('shows placeholder when timeline has no segments', () => {
    useTimelineStore.setState({
      timeline: makeTimeline({
        tracks: [{ id: 'track-1', type: 'clip', segments: [], zOrder: 0, label: 'Video', muted: false, locked: false }],
      }),
    })
    const { container } = render(<PlaybackPanel />)
    expect(container.textContent).toMatch(/no video/i)
  })

  it('renders video element when playhead is over a segment', () => {
    useTimelineStore.setState({
      timeline: makeTimeline(),
      playheadPosition: 2000,
    })
    useLibraryStore.setState({ clips: [makeClip()] })

    const { container } = render(<PlaybackPanel />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toBe('media:///path/to/video.mp4')
  })

  it('shows placeholder when playhead is outside all segments', () => {
    useTimelineStore.setState({
      timeline: makeTimeline(),
      playheadPosition: 6000, // beyond segment end (5000)
    })
    useLibraryStore.setState({ clips: [makeClip()] })

    const { container } = render(<PlaybackPanel />)
    expect(container.querySelector('video')).toBeNull()
  })

  it('switches video source when playhead moves to a different segment', () => {
    const timeline = makeTimeline({
      tracks: [{
        id: 'track-1',
        type: 'clip',
        segments: [
          makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000, sourceFile: '/video-a.mp4' }),
          makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000, sourceFile: '/video-b.mp4' }),
        ],
        zOrder: 0,
        label: 'Video',
        muted: false,
        locked: false,
      }],
      duration: 6000,
    })
    useTimelineStore.setState({ timeline, playheadPosition: 1000 })
    useLibraryStore.setState({
      clips: [
        makeClip({ id: 'c-a', filePath: '/video-a.mp4' }),
        makeClip({ id: 'c-b', filePath: '/video-b.mp4' }),
      ],
    })

    const { container, rerender } = render(<PlaybackPanel />)
    expect(container.querySelector('video')?.getAttribute('src')).toBe('media:///video-a.mp4')

    // Move playhead to second segment
    useTimelineStore.setState({ playheadPosition: 4000 })
    rerender(<PlaybackPanel />)
    expect(container.querySelector('video')?.getAttribute('src')).toBe('media:///video-b.mp4')
  })
})
