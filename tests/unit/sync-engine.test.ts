import { describe, it, expect } from 'vitest'
import {
  convertDOMEventsToSyncPoints,
  assembleSyncTimeline,
  resolveConflicts,
  adjustDurationsForNarration,
} from '@main/services/sync'
import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'

describe('convertDOMEventsToSyncPoints', () => {
  const timelineId = 'tl-1'

  it('converts click events to freeze sync points', () => {
    const events: DOMEvent[] = [
      {
        id: 'e1',
        type: 'click',
        timestamp: 2000,
        elementSelector: 'button.submit',
        coordinates: { x: 100, y: 200 },
        elementText: 'Submit',
      },
    ]

    const candidates = convertDOMEventsToSyncPoints(events, timelineId)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].syncPoint.type).toBe('freeze')
    expect(candidates[0].syncPoint.timestamp).toBe(2000)
    expect(candidates[0].syncPoint.source).toBe('dom')
  })

  it('converts submit events to annotation sync points', () => {
    const events: DOMEvent[] = [
      {
        id: 'e1',
        type: 'submit',
        timestamp: 5000,
        elementSelector: 'form.login',
        coordinates: { x: 0, y: 0 },
        elementText: 'Login Form',
      },
    ]

    const candidates = convertDOMEventsToSyncPoints(events, timelineId)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].syncPoint.type).toBe('annotation')
    expect(candidates[0].syncPoint.annotationText).toContain('Login Form')
  })

  it('converts navigate events to transition sync points', () => {
    const events: DOMEvent[] = [
      {
        id: 'e1',
        type: 'navigate',
        timestamp: 10000,
        elementSelector: '',
        coordinates: { x: 0, y: 0 },
        url: 'https://example.com/page2',
      },
    ]

    const candidates = convertDOMEventsToSyncPoints(events, timelineId)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].syncPoint.type).toBe('transition')
    expect(candidates[0].syncPoint.transitionType).toBe('fade')
  })

  it('converts focus events to zoom sync points', () => {
    const events: DOMEvent[] = [
      {
        id: 'e1',
        type: 'focus',
        timestamp: 3000,
        elementSelector: 'input.email',
        coordinates: { x: 300, y: 150 },
        elementText: 'Email',
      },
    ]

    const candidates = convertDOMEventsToSyncPoints(events, timelineId)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].syncPoint.type).toBe('zoom')
    expect(candidates[0].syncPoint.coordinates).toBeDefined()
  })

  it('skips input and scroll events', () => {
    const events: DOMEvent[] = [
      {
        id: 'e1',
        type: 'input',
        timestamp: 1000,
        elementSelector: 'input',
        coordinates: { x: 0, y: 0 },
      },
      {
        id: 'e2',
        type: 'scroll',
        timestamp: 2000,
        elementSelector: 'body',
        coordinates: { x: 0, y: 500 },
      },
    ]

    const candidates = convertDOMEventsToSyncPoints(events, timelineId)
    expect(candidates).toHaveLength(0)
  })

  it('handles mixed event types', () => {
    const events: DOMEvent[] = [
      { id: 'e1', type: 'focus', timestamp: 1000, elementSelector: 'input', coordinates: { x: 100, y: 100 } },
      { id: 'e2', type: 'input', timestamp: 1500, elementSelector: 'input', coordinates: { x: 0, y: 0 } },
      { id: 'e3', type: 'click', timestamp: 3000, elementSelector: 'button', coordinates: { x: 200, y: 300 } },
      { id: 'e4', type: 'navigate', timestamp: 4000, elementSelector: '', coordinates: { x: 0, y: 0 }, url: '/page2' },
      { id: 'e5', type: 'scroll', timestamp: 5000, elementSelector: 'body', coordinates: { x: 0, y: 1000 } },
    ]

    const candidates = convertDOMEventsToSyncPoints(events, timelineId)
    // focus + click + navigate = 3 (input and scroll skipped)
    expect(candidates).toHaveLength(3)
    expect(candidates.map((c) => c.syncPoint.type)).toEqual(['zoom', 'freeze', 'transition'])
  })
})

describe('resolveConflicts', () => {
  it('keeps all points when they are well-spaced', () => {
    const points: SyncPoint[] = [
      makeSyncPoint(1000, 'freeze', 500, 0.7),
      makeSyncPoint(5000, 'zoom', 1000, 0.8),
      makeSyncPoint(10000, 'transition', 500, 0.9),
    ]

    const resolved = resolveConflicts(points)
    expect(resolved).toHaveLength(3)
  })

  it('removes overlapping lower-confidence points', () => {
    const points: SyncPoint[] = [
      makeSyncPoint(1000, 'freeze', 2000, 0.7), // ends at 3000
      makeSyncPoint(2500, 'zoom', 1000, 0.9),    // starts 500ms before end — conflict, higher confidence
    ]

    const resolved = resolveConflicts(points)
    expect(resolved).toHaveLength(1)
    expect(resolved[0].type).toBe('zoom') // higher confidence wins
  })

  it('keeps higher-confidence earlier point when it wins', () => {
    const points: SyncPoint[] = [
      makeSyncPoint(1000, 'freeze', 2000, 0.9), // ends at 3000
      makeSyncPoint(2500, 'zoom', 1000, 0.5),    // conflict, lower confidence
    ]

    const resolved = resolveConflicts(points)
    expect(resolved).toHaveLength(1)
    expect(resolved[0].type).toBe('freeze')
  })

  it('handles empty and single-item lists', () => {
    expect(resolveConflicts([])).toEqual([])
    const single = [makeSyncPoint(1000, 'freeze', 500, 0.7)]
    expect(resolveConflicts(single)).toHaveLength(1)
  })
})

describe('assembleSyncTimeline', () => {
  it('merges DOM and AI candidates sorted by timestamp', () => {
    const domCandidates = [
      { syncPoint: makeSyncPoint(5000, 'freeze', 1000, 0.7), confidence: 0.7 },
      { syncPoint: makeSyncPoint(1000, 'zoom', 1000, 0.6), confidence: 0.6 },
    ]

    const aiCandidates = [
      makeSyncPoint(3000, 'annotation', 2000, 0.8),
    ]

    const result = assembleSyncTimeline(domCandidates, aiCandidates)
    expect(result.length).toBeGreaterThanOrEqual(2)
    // Should be sorted by timestamp
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp)
    }
  })
})

describe('adjustDurationsForNarration', () => {
  it('extends freeze duration to match narration', () => {
    const points: SyncPoint[] = [
      makeSyncPoint(2000, 'freeze', 1000, 0.7),
    ]

    const sectionDurations = [
      { startTime: 1500, duration: 3000 }, // narration covers 1.5s - 4.5s
    ]

    const adjusted = adjustDurationsForNarration(points, sectionDurations)
    expect(adjusted[0].duration).toBe(3000) // extended to match narration
  })

  it('does not shrink freeze duration', () => {
    const points: SyncPoint[] = [
      makeSyncPoint(2000, 'freeze', 5000, 0.7),
    ]

    const sectionDurations = [
      { startTime: 1500, duration: 2000 },
    ]

    const adjusted = adjustDurationsForNarration(points, sectionDurations)
    expect(adjusted[0].duration).toBe(5000) // unchanged
  })

  it('does not modify non-freeze sync points', () => {
    const points: SyncPoint[] = [
      makeSyncPoint(2000, 'zoom', 1000, 0.7),
    ]

    const sectionDurations = [
      { startTime: 1500, duration: 5000 },
    ]

    const adjusted = adjustDurationsForNarration(points, sectionDurations)
    expect(adjusted[0].duration).toBe(1000) // unchanged
  })
})

function makeSyncPoint(
  timestamp: number,
  type: SyncPoint['type'],
  duration: number,
  confidence: number,
): SyncPoint {
  return {
    id: `sp-${timestamp}`,
    timelineId: 'tl-1',
    timestamp,
    type,
    source: 'dom',
    duration,
    confidence,
  }
}
