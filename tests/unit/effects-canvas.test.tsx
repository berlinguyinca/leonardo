// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import { useOverlayEditorStore } from '../../src/renderer/stores/overlay-editor-store'
import type { SyncTimeline, Track, Segment, Clip } from '@shared/types'
import { defaultOverlayMetadata } from '@shared/types'

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

function makeClipTrack(overrides?: Partial<Track>): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments: [makeSegment()],
    zOrder: 0,
    label: 'Video',
    muted: false,
    locked: false,
    ...overrides,
  }
}

function makeOverlayTrack(segmentId = 'overlay-seg-1', metadata?: string): Track {
  const meta = metadata ?? JSON.stringify(defaultOverlayMetadata('title'))
  return {
    id: 'overlay-track-1',
    type: 'overlay',
    segments: [
      {
        id: segmentId,
        trackId: 'overlay-track-1',
        startTime: 0,
        endTime: 5000,
        sourceFile: '',
        sourceOffset: 0,
        label: 'Title',
        metadata: meta,
      },
    ],
    zOrder: 1,
    label: 'Overlay',
    muted: false,
    locked: false,
  }
}

function makeTimeline(tracks: Track[]): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks,
    syncPoints: [],
    duration: 5000,
    reviewed: false,
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

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

import { EffectsCanvas } from '../../src/renderer/components/effects/EffectsCanvas'

describe('EffectsCanvas', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: null,
      playheadPosition: 0,
      isPlaying: false,
      playbackRate: 1,
      selectedSegmentId: null,
    })
    useLibraryStore.setState({ clips: [] })
    useOverlayEditorStore.setState({ selectedElementId: null, editorMode: 'select' })
  })

  it('renders without crashing when no timeline', () => {
    const { container } = render(<EffectsCanvas />)
    expect(container.firstChild).not.toBeNull()
    expect(container.querySelector('video')).toBeNull()
  })

  it('shows placeholder text when no timeline', () => {
    const { container } = render(<EffectsCanvas />)
    expect(container.textContent).toMatch(/no video/i)
  })

  it('renders video player when clip segment exists at playhead', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([makeClipTrack()]),
      playheadPosition: 1000,
    })
    useLibraryStore.setState({ clips: [makeClip()] })

    const { container } = render(<EffectsCanvas />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toBe('media:////path/to/video.mp4')
  })

  it('does not render video when playhead is past clip segment end', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([makeClipTrack()]),
      playheadPosition: 6000,
    })
    useLibraryStore.setState({ clips: [makeClip()] })

    const { container } = render(<EffectsCanvas />)
    expect(container.querySelector('video')).toBeNull()
  })

  it('renders text overlay element when overlay segment exists at playhead', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([makeClipTrack(), makeOverlayTrack()]),
      playheadPosition: 1000,
    })
    useLibraryStore.setState({ clips: [makeClip()] })

    const { container } = render(<EffectsCanvas />)
    // The overlay element should appear — default overlay says "Title"
    expect(container.textContent).toContain('Title')
  })

  it('does not render overlay element when no overlay segment at playhead', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([makeClipTrack()]),
      playheadPosition: 1000,
    })
    useLibraryStore.setState({ clips: [makeClip()] })

    const { container } = render(<EffectsCanvas />)
    // Only the video renders, no overlay text from defaultOverlayMetadata
    expect(container.querySelector('video')).not.toBeNull()
    expect(container.textContent).not.toContain('Title')
  })
})

import { PlaybackPanel } from '../../src/renderer/components/preview/PlaybackPanel'

describe('PlaybackPanel — findSegmentAt overlay fix', () => {
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

  it('shows video when overlay segment also exists at playhead (does not incorrectly match overlay)', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([makeClipTrack(), makeOverlayTrack()]),
      playheadPosition: 1000,
    })
    useLibraryStore.setState({ clips: [makeClip()] })

    const { container } = render(<PlaybackPanel />)
    // Should show video (not fall through to "no video" placeholder)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toBe('media:////path/to/video.mp4')
  })

  it('shows placeholder when only overlay track exists (no clip)', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([makeOverlayTrack()]),
      playheadPosition: 1000,
    })
    useLibraryStore.setState({ clips: [] })

    const { container } = render(<PlaybackPanel />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.textContent).toMatch(/no video/i)
  })
})
