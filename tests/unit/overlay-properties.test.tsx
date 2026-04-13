// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'
import { defaultOverlayMetadata, parseOverlayMetadata } from '@shared/types'
import type { Segment, SyncTimeline } from '@shared/types'
import { OverlayProperties } from '../../src/renderer/components/effects/OverlayProperties'

function makeOverlaySegment(overrides?: Partial<Segment>): Segment {
  const meta = defaultOverlayMetadata('title')
  return {
    id: 'overlay-seg-1',
    trackId: 'overlay-track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '',
    sourceOffset: 0,
    label: 'Title',
    metadata: JSON.stringify(meta),
    ...overrides,
  }
}

function makeTimeline(segment: Segment): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [
      {
        id: 'overlay-track-1',
        type: 'overlay',
        segments: [segment],
        zOrder: 0,
        label: 'Overlay',
        muted: false,
        locked: false,
      },
    ],
    syncPoints: [],
    duration: 5000,
    reviewed: false,
  }
}

describe('OverlayProperties', () => {
  let segment: Segment

  beforeEach(() => {
    segment = makeOverlaySegment()
    useTimelineStore.setState({
      timeline: makeTimeline(segment),
      selectedSegmentId: segment.id,
    })
  })

  it('renders fields for a selected overlay segment', () => {
    const { container } = render(<OverlayProperties segment={segment} />)
    expect(container.querySelector('textarea')).not.toBeNull()
    const labels = container.querySelectorAll('.properties-label')
    const labelTexts = Array.from(labels).map((l) => l.textContent)
    expect(labelTexts).toContain('Text')
    expect(labelTexts).toContain('Font Family')
    expect(labelTexts).toContain('Transition In')
    expect(labelTexts).toContain('Transition Out')
  })

  it('shows placeholder when segment has no metadata', () => {
    const noMetaSeg: Segment = { ...segment, metadata: undefined }
    const { container } = render(<OverlayProperties segment={noMetaSeg} />)
    expect(container.textContent).toMatch(/no overlay data/i)
  })

  it('changing text updates segment metadata in store', () => {
    const { container } = render(<OverlayProperties segment={segment} />)
    const textarea = container.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: 'My New Title' } })

    const state = useTimelineStore.getState()
    const updatedSeg = state.timeline?.tracks[0].segments[0]
    const meta = parseOverlayMetadata(updatedSeg!)
    expect(meta?.element.text).toBe('My New Title')
  })

  it('changing position X updates segment metadata in store', () => {
    const { container } = render(<OverlayProperties segment={segment} />)

    // Find the Position X input (first number input after "Position X (%)" label)
    const labels = Array.from(container.querySelectorAll('.properties-label'))
    const posXLabel = labels.find((l) => l.textContent === 'Position X (%)')
    const posXInput = posXLabel?.parentElement?.querySelector('input[type="number"]') as HTMLInputElement

    expect(posXInput).not.toBeNull()
    fireEvent.change(posXInput, { target: { value: '25' } })

    const state = useTimelineStore.getState()
    const updatedSeg = state.timeline?.tracks[0].segments[0]
    const meta = parseOverlayMetadata(updatedSeg!)
    expect(meta?.element.x).toBe(25)
  })

  it('changing font family updates segment metadata in store', () => {
    const { container } = render(<OverlayProperties segment={segment} />)

    const labels = Array.from(container.querySelectorAll('.properties-label'))
    const fontLabel = labels.find((l) => l.textContent === 'Font Family')
    const select = fontLabel?.parentElement?.querySelector('select') as HTMLSelectElement

    fireEvent.change(select, { target: { value: 'Georgia' } })

    const state = useTimelineStore.getState()
    const updatedSeg = state.timeline?.tracks[0].segments[0]
    const meta = parseOverlayMetadata(updatedSeg!)
    expect(meta?.element.fontFamily).toBe('Georgia')
  })
})
