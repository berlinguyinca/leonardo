// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useLibraryStore } from '../../src/renderer/stores/library-store'
import { useScriptStore } from '../../src/renderer/stores/script-store'
import type { SyncTimeline, Clip, Segment } from '@shared/types'

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

function makeTimeline(segments: Segment[]): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [{
      id: 'track-1',
      type: 'clip',
      segments,
      zOrder: 0,
      label: 'Video',
      muted: false,
      locked: false,
    }],
    syncPoints: [],
    duration: segments.reduce((max, s) => Math.max(max, s.endTime), 0),
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
  ;(window as Record<string, unknown>).leonardo = {
    clip: {
      delete: vi.fn().mockResolvedValue(true),
    },
  }
})

afterEach(() => {
  delete (window as Record<string, unknown>).leonardo
})

describe('removeSegmentsBySourceFile', () => {
  it('removes all segments matching the source file', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([
        makeSegment({ id: 'seg-1', sourceFile: '/video-a.mp4', endTime: 3000 }),
        makeSegment({ id: 'seg-2', sourceFile: '/video-b.mp4', startTime: 3000, endTime: 6000 }),
        makeSegment({ id: 'seg-3', sourceFile: '/video-a.mp4', startTime: 6000, endTime: 9000 }),
      ]),
    })

    useTimelineStore.getState().removeSegmentsBySourceFile('/video-a.mp4')

    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    expect(segments).toHaveLength(1)
    expect(segments[0].id).toBe('seg-2')
  })

  it('recomputes timeline duration after removal', () => {
    useTimelineStore.setState({
      timeline: makeTimeline([
        makeSegment({ id: 'seg-1', sourceFile: '/video-a.mp4', endTime: 10000 }),
        makeSegment({ id: 'seg-2', sourceFile: '/video-b.mp4', startTime: 0, endTime: 3000 }),
      ]),
    })

    useTimelineStore.getState().removeSegmentsBySourceFile('/video-a.mp4')
    expect(useTimelineStore.getState().timeline!.duration).toBe(3000)
  })

  it('does nothing when timeline is null', () => {
    useTimelineStore.setState({ timeline: null })
    useTimelineStore.getState().removeSegmentsBySourceFile('/video-a.mp4')
    expect(useTimelineStore.getState().timeline).toBeNull()
  })
})

describe('removeClipScript', () => {
  it('removes the clipId entry from clipScripts', () => {
    useScriptStore.setState({
      clipScripts: {
        'clip-1': [{ id: 's1', scriptId: 'x', text: 'hello', order: 0, startTime: 0, endTime: 1, voiceProfileId: null, timingMarkers: [] }],
        'clip-2': [{ id: 's2', scriptId: 'y', text: 'world', order: 0, startTime: 0, endTime: 1, voiceProfileId: null, timingMarkers: [] }],
      },
    })

    useScriptStore.getState().removeClipScript('clip-1')

    expect(useScriptStore.getState().clipScripts['clip-1']).toBeUndefined()
    expect(useScriptStore.getState().clipScripts['clip-2']).toBeDefined()
  })
})

describe('removeClip cascade', () => {
  it('removes clip, its segments, and its scripts in one call', async () => {
    useLibraryStore.setState({
      clips: [
        makeClip({ id: 'clip-1', filePath: '/video-a.mp4' }),
        makeClip({ id: 'clip-2', filePath: '/video-b.mp4' }),
      ],
    })
    useTimelineStore.setState({
      timeline: makeTimeline([
        makeSegment({ id: 'seg-1', sourceFile: '/video-a.mp4', endTime: 5000 }),
        makeSegment({ id: 'seg-2', sourceFile: '/video-b.mp4', startTime: 5000, endTime: 10000 }),
      ]),
    })
    useScriptStore.setState({
      clipScripts: {
        'clip-1': [{ id: 's1', scriptId: 'x', text: 'hello', order: 0, startTime: 0, endTime: 1, voiceProfileId: null, timingMarkers: [] }],
      },
    })

    await useLibraryStore.getState().removeClip('clip-1')

    // Clip removed from library
    expect(useLibraryStore.getState().clips).toHaveLength(1)
    expect(useLibraryStore.getState().clips[0].id).toBe('clip-2')

    // Segments referencing clip-1's file removed
    const segments = useTimelineStore.getState().timeline!.tracks[0].segments
    expect(segments).toHaveLength(1)
    expect(segments[0].id).toBe('seg-2')

    // Script entry removed
    expect(useScriptStore.getState().clipScripts['clip-1']).toBeUndefined()

    // Duration recomputed
    expect(useTimelineStore.getState().timeline!.duration).toBe(10000)
  })
})
