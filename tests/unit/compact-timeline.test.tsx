// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import type { SyncTimeline, Track, Segment } from '@shared/types'

vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: { clips: never[] }) => unknown) => selector({ clips: [] }),
}))
vi.mock('../../src/renderer/stores/ui-store', () => ({
  useUIStore: (selector: (s: { workspacePreset: string }) => unknown) =>
    selector({ workspacePreset: 'script' }),
}))
vi.mock('../../src/renderer/hooks/usePlayhead', () => ({
  usePlayhead: () => ({ seekTo: vi.fn() }),
}))
vi.mock('../../src/renderer/hooks/useTimelineZoom', () => ({
  useTimelineZoom: () => ({ zoom: vi.fn(), handleWheel: vi.fn() }),
}))
vi.mock('../../src/renderer/hooks/PlayheadEmitter', () => ({
  playheadEmitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}))
vi.mock('../../src/renderer/components/timeline/TimeRuler', () => ({
  TimeRuler: () => null,
}))
vi.mock('../../src/renderer/components/timeline/Playhead', () => ({
  Playhead: () => null,
}))
vi.mock('../../src/renderer/components/timeline/TrackLane', () => ({
  TrackLane: () => null,
}))
vi.mock('../../src/renderer/components/timeline/ScrollContainer', () => ({
  ScrollContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../../src/renderer/components/timeline/ZoomControls', () => ({
  ZoomControls: () => null,
}))
vi.mock('../../src/renderer/components/timeline/TransportControls', () => ({
  TransportControls: () => null,
}))

// Import after mocks
import { Timeline } from '../../src/renderer/components/timeline/Timeline'

function makeSegment(): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 3000,
    sourceFile: '/tmp/video.mp4',
    sourceOffset: 0,
    label: 'Seg 1',
  }
}

function makeTrack(): Track {
  return {
    id: 'track-1',
    type: 'clip',
    segments: [makeSegment()],
    zOrder: 0,
    label: 'Video',
    muted: false,
    locked: false,
  }
}

function makeTimeline(): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'proj-1',
    tracks: [makeTrack()],
    syncPoints: [],
    duration: 3000,
    reviewed: false,
  }
}

describe('Compact timeline in script preset', () => {
  beforeEach(() => {
    useTimelineStore.setState({ timeline: makeTimeline(), selectedSegmentId: null })
  })

  it('does not render ScriptTextTrack when workspacePreset is script', () => {
    const { container } = render(<Timeline />)
    expect(container.querySelector('.script-text-track')).toBeNull()
  })
})
