import type { DOMEvent } from '@shared/types/events'
import type { SyncPoint } from '@shared/types/timeline'
import { v4 as uuidv4 } from 'uuid'

export interface SyncPointCandidate {
  syncPoint: SyncPoint
  confidence: number
}

/**
 * Convert DOM events into sync point candidates.
 * Each event type maps to a default sync point type:
 * - click → freeze (pause at click moment)
 * - submit → annotation (highlight form area)
 * - navigate → transition (scene break)
 * - focus → zoom (zoom to input field)
 * - input → (skipped, too frequent)
 * - scroll → (skipped, too frequent)
 */
export function convertDOMEventsToSyncPoints(
  events: DOMEvent[],
  timelineId: string,
): SyncPointCandidate[] {
  const candidates: SyncPointCandidate[] = []

  for (const event of events) {
    const candidate = mapEventToCandidate(event, timelineId)
    if (candidate) {
      candidates.push(candidate)
    }
  }

  return candidates
}

function mapEventToCandidate(event: DOMEvent, timelineId: string): SyncPointCandidate | null {
  switch (event.type) {
    case 'click':
      return {
        syncPoint: {
          id: uuidv4(),
          timelineId,
          timestamp: event.timestamp,
          type: 'freeze',
          source: 'dom',
          duration: 1500, // 1.5s default freeze
          coordinates: {
            x: event.coordinates.x,
            y: event.coordinates.y,
            width: 100,
            height: 100,
          },
          confidence: 0.7,
        },
        confidence: 0.7,
      }

    case 'submit':
      return {
        syncPoint: {
          id: uuidv4(),
          timelineId,
          timestamp: event.timestamp,
          type: 'annotation',
          source: 'dom',
          duration: 2000,
          annotationText: `Form submitted: ${event.elementText || event.elementSelector}`,
          confidence: 0.85,
        },
        confidence: 0.85,
      }

    case 'navigate':
      return {
        syncPoint: {
          id: uuidv4(),
          timelineId,
          timestamp: event.timestamp,
          type: 'transition',
          source: 'dom',
          duration: 500,
          transitionType: 'fade',
          confidence: 0.9,
        },
        confidence: 0.9,
      }

    case 'focus':
      return {
        syncPoint: {
          id: uuidv4(),
          timelineId,
          timestamp: event.timestamp,
          type: 'zoom',
          source: 'dom',
          duration: 2000,
          coordinates: {
            x: event.coordinates.x - 150,
            y: event.coordinates.y - 50,
            width: 300,
            height: 100,
          },
          confidence: 0.6,
        },
        confidence: 0.6,
      }

    case 'input':
    case 'scroll':
      // Too frequent — skip by default
      return null

    default:
      return null
  }
}
