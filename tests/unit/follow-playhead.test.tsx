// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, screen, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { useUIStore } from '../../src/renderer/stores/ui-store'
import { playheadEmitter } from '../../src/renderer/hooks/PlayheadEmitter'
import type { SyncTimeline, Track, Segment } from '@shared/types'

// Minimal mocks so PropertiesPanel renders without SegmentProperties/SyncPointProperties blowing up
vi.mock('../../src/renderer/components/properties/SegmentProperties', () => ({
  SegmentProperties: ({ segment }: { segment: Segment }) => (
    <div data-testid="segment-props">{segment.id}</div>
  ),
}))
vi.mock('../../src/renderer/components/properties/SyncPointProperties', () => ({
  SyncPointProperties: () => <div data-testid="sync-props" />,
}))
vi.mock('../../src/renderer/components/properties/InteractionsPanel', () => ({
  InteractionsPanel: () => null,
}))

import { PropertiesPanel } from '../../src/renderer/components/properties/PropertiesPanel'

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 3000,
    sourceFile: '/tmp/video.mp4',
    sourceOffset: 0,
    label: 'Seg 1',
    ...overrides,
  }
}

function makeTrack(segments: Segment[], type: Track['type'] = 'clip'): Track {
  return {
    id: 'track-1',
    type,
    segments,
    zOrder: 0,
    label: 'Track',
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
    duration: 6000,
    reviewed: false,
  }
}

beforeEach(() => {
  useTimelineStore.setState({
    timeline: null,
    playheadPosition: 0,
    isPlaying: false,
    selectedSegmentId: null,
    selectedSyncPointId: null,
  })
  useUIStore.setState({ followPlayhead: false })
})

afterEach(() => {
  vi.restoreAllMocks()
  // Remove all listeners from emitter
  playheadEmitter.all.clear()
})

describe('PropertiesPanel — Follow Playhead toggle', () => {
  it('renders Follow button', () => {
    const seg = makeSegment()
    useTimelineStore.setState({ timeline: makeTimeline([makeTrack([seg])]) })

    render(<PropertiesPanel />)

    expect(screen.getByRole('button', { name: /follow/i })).toBeInTheDocument()
  })

  it('toggles followPlayhead in ui-store when Follow button clicked', () => {
    const seg = makeSegment()
    useTimelineStore.setState({ timeline: makeTimeline([makeTrack([seg])]) })

    render(<PropertiesPanel />)
    const btn = screen.getByRole('button', { name: /follow/i })

    expect(useUIStore.getState().followPlayhead).toBe(false)
    fireEvent.click(btn)
    expect(useUIStore.getState().followPlayhead).toBe(true)
    fireEvent.click(btn)
    expect(useUIStore.getState().followPlayhead).toBe(false)
  })

  it('updates selectedSegmentId on segment boundary crossing when follow ON and playing', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const seg2 = makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000 })
    const timeline = makeTimeline([makeTrack([seg1, seg2])])

    useTimelineStore.setState({ timeline, isPlaying: true, selectedSegmentId: 'seg-1' })
    useUIStore.setState({ followPlayhead: true })

    render(<PropertiesPanel />)

    // Playhead moves into seg-1 range — no change expected
    act(() => { playheadEmitter.emit('position', 1000) })
    expect(useTimelineStore.getState().selectedSegmentId).toBe('seg-1')

    // Playhead crosses into seg-2
    act(() => { playheadEmitter.emit('position', 3500) })
    expect(useTimelineStore.getState().selectedSegmentId).toBe('seg-2')
  })

  it('does NOT update selectedSegmentId on every tick — only boundary crossings', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const timeline = makeTimeline([makeTrack([seg1])])

    useTimelineStore.setState({ timeline, isPlaying: true, selectedSegmentId: null })
    useUIStore.setState({ followPlayhead: true })

    const setSelectedSegment = vi.spyOn(useTimelineStore.getState(), 'setSelectedSegment')

    render(<PropertiesPanel />)

    // First tick — boundary crossing: null → seg-1
    act(() => { playheadEmitter.emit('position', 500) })
    // Second tick — same segment, no crossing
    act(() => { playheadEmitter.emit('position', 1000) })
    // Third tick — same segment, no crossing
    act(() => { playheadEmitter.emit('position', 1500) })

    // setSelectedSegment called exactly once (the initial boundary crossing)
    expect(setSelectedSegment).toHaveBeenCalledTimes(1)
    expect(setSelectedSegment).toHaveBeenCalledWith('seg-1')
  })

  it('does not change selectedSegmentId when follow is OFF during playback', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const seg2 = makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000 })
    const timeline = makeTimeline([makeTrack([seg1, seg2])])

    useTimelineStore.setState({ timeline, isPlaying: true, selectedSegmentId: 'seg-1' })
    useUIStore.setState({ followPlayhead: false })

    render(<PropertiesPanel />)

    act(() => { playheadEmitter.emit('position', 4000) })

    // Should remain on manually selected seg-1
    expect(useTimelineStore.getState().selectedSegmentId).toBe('seg-1')
  })

  it('does not update when follow is ON but not playing', () => {
    const seg1 = makeSegment({ id: 'seg-1', startTime: 0, endTime: 3000 })
    const seg2 = makeSegment({ id: 'seg-2', startTime: 3000, endTime: 6000 })
    const timeline = makeTimeline([makeTrack([seg1, seg2])])

    useTimelineStore.setState({ timeline, isPlaying: false, selectedSegmentId: 'seg-1' })
    useUIStore.setState({ followPlayhead: true })

    render(<PropertiesPanel />)

    act(() => { playheadEmitter.emit('position', 4000) })

    expect(useTimelineStore.getState().selectedSegmentId).toBe('seg-1')
  })

  it('ignores overlay/audio tracks when following playhead', () => {
    const videoSeg = makeSegment({ id: 'seg-video', startTime: 0, endTime: 6000 })
    const overlaySeg = makeSegment({ id: 'seg-overlay', startTime: 0, endTime: 6000, trackId: 'track-overlay' })
    const overlayTrack: Track = {
      id: 'track-overlay',
      type: 'overlay',
      segments: [overlaySeg],
      zOrder: 1,
      label: 'Overlay',
      muted: false,
      locked: false,
    }
    const timeline = makeTimeline([makeTrack([videoSeg]), overlayTrack])

    useTimelineStore.setState({ timeline, isPlaying: true, selectedSegmentId: null })
    useUIStore.setState({ followPlayhead: true })

    render(<PropertiesPanel />)

    act(() => { playheadEmitter.emit('position', 1000) })

    // Should select the video segment, not the overlay segment
    expect(useTimelineStore.getState().selectedSegmentId).toBe('seg-video')
  })

  it('followPlayhead state is stored in ui-store and persists', () => {
    useUIStore.setState({ followPlayhead: false })
    expect(useUIStore.getState().followPlayhead).toBe(false)

    useUIStore.getState().setFollowPlayhead(true)
    expect(useUIStore.getState().followPlayhead).toBe(true)

    useUIStore.getState().setFollowPlayhead(false)
    expect(useUIStore.getState().followPlayhead).toBe(false)
  })
})
