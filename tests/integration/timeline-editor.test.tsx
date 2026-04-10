// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { PropertiesPanel } from '@renderer/components/properties/PropertiesPanel'
import type { SyncTimeline, SyncPoint, Track, Segment } from '@shared/types'

function makeSyncPoint(overrides: Partial<SyncPoint> = {}): SyncPoint {
  return {
    id: 'sp-1',
    timelineId: 'tl-1',
    timestamp: 2000,
    type: 'freeze',
    source: 'dom',
    duration: 1000,
    confidence: 0.8,
    ...overrides,
  }
}

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/tmp/video.mp4',
    sourceOffset: 0,
    label: 'Recording',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'recording',
    segments: [makeSegment()],
    zOrder: 0,
    label: 'Recording',
    muted: false,
    locked: false,
    ...overrides,
  }
}

function makeTimeline(overrides: Partial<SyncTimeline> = {}): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [makeTrack()],
    syncPoints: [makeSyncPoint()],
    duration: 30000,
    reviewed: false,
    ...overrides,
  }
}

describe('Timeline Editor (integration)', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: makeTimeline(),
      playheadPosition: 0,
      zoomLevel: 1,
      selectedSyncPointId: null,
      selectedSegmentId: null,
      isPlaying: false,
    })
  })

  describe('sync point CRUD via store', () => {
    it('adds a sync point to the timeline', () => {
      const newPoint = makeSyncPoint({ id: 'sp-2', timestamp: 5000, type: 'zoom' })
      useTimelineStore.getState().addSyncPoint(newPoint)

      const timeline = useTimelineStore.getState().timeline!
      expect(timeline.syncPoints).toHaveLength(2)
      expect(timeline.syncPoints[1].type).toBe('zoom')
    })

    it('updates sync point properties', () => {
      useTimelineStore.getState().updateSyncPoint('sp-1', { timestamp: 3000, type: 'annotation' })

      const sp = useTimelineStore.getState().timeline!.syncPoints[0]
      expect(sp.timestamp).toBe(3000)
      expect(sp.type).toBe('annotation')
    })

    it('removes a sync point', () => {
      useTimelineStore.getState().removeSyncPoint('sp-1')

      const timeline = useTimelineStore.getState().timeline!
      expect(timeline.syncPoints).toHaveLength(0)
    })
  })

  describe('undo/redo', () => {
    it('undoes sync point addition', () => {
      const newPoint = makeSyncPoint({ id: 'sp-2', timestamp: 5000 })
      useTimelineStore.getState().addSyncPoint(newPoint)
      expect(useTimelineStore.getState().timeline!.syncPoints).toHaveLength(2)

      useTimelineStore.temporal.getState().undo()
      expect(useTimelineStore.getState().timeline!.syncPoints).toHaveLength(1)
    })

    it('redoes sync point addition', () => {
      const newPoint = makeSyncPoint({ id: 'sp-2', timestamp: 5000 })
      useTimelineStore.getState().addSyncPoint(newPoint)
      useTimelineStore.temporal.getState().undo()
      useTimelineStore.temporal.getState().redo()

      expect(useTimelineStore.getState().timeline!.syncPoints).toHaveLength(2)
    })

    it('undoes sync point update', () => {
      useTimelineStore.getState().updateSyncPoint('sp-1', { timestamp: 9999 })
      useTimelineStore.temporal.getState().undo()

      expect(useTimelineStore.getState().timeline!.syncPoints[0].timestamp).toBe(2000)
    })
  })

  describe('PropertiesPanel integration', () => {
    it('shows placeholder when nothing is selected', () => {
      render(<PropertiesPanel />)
      expect(screen.getByText('Select an item to edit')).toBeDefined()
    })

    it('shows sync point properties when a sync point is selected', () => {
      useTimelineStore.setState({ selectedSyncPointId: 'sp-1' })
      render(<PropertiesPanel />)
      expect(screen.getByDisplayValue('2000')).toBeDefined()
    })

    it('shows segment properties when a segment is selected', () => {
      useTimelineStore.setState({ selectedSegmentId: 'seg-1' })
      render(<PropertiesPanel />)
      expect(screen.getByText('Recording')).toBeDefined()
    })
  })
})
