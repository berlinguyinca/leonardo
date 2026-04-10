import type { SyncPoint } from '@shared/types/timeline'
import type { SyncPointCandidate } from './dom-to-sync'

const MIN_SYNC_POINT_GAP_MS = 1000 // Minimum 1s between sync points

/**
 * Merge DOM-based and AI-based sync point candidates into a final list.
 * Resolves conflicts (overlapping, too-close timing).
 */
export function assembleSyncTimeline(
  domCandidates: SyncPointCandidate[],
  aiCandidates: SyncPoint[],
): SyncPoint[] {
  // Combine both sources
  const allPoints: SyncPoint[] = [
    ...domCandidates.map((c) => c.syncPoint),
    ...aiCandidates.map((p) => ({ ...p, source: 'script' as const })),
  ]

  // Sort by timestamp
  allPoints.sort((a, b) => a.timestamp - b.timestamp)

  // Resolve conflicts: remove points that are too close together
  return resolveConflicts(allPoints)
}

/**
 * Remove sync points that overlap or are too close.
 * When two points conflict, keep the one with higher confidence.
 */
export function resolveConflicts(points: SyncPoint[]): SyncPoint[] {
  if (points.length <= 1) return points

  const resolved: SyncPoint[] = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const current = points[i]
    const previous = resolved[resolved.length - 1]

    const prevEnd = previous.timestamp + previous.duration
    const gap = current.timestamp - prevEnd

    if (gap >= MIN_SYNC_POINT_GAP_MS) {
      // No conflict — add
      resolved.push(current)
    } else if (current.confidence > previous.confidence) {
      // Current is higher confidence — replace previous
      resolved[resolved.length - 1] = current
    }
    // Otherwise, skip current (previous wins)
  }

  return resolved
}

/**
 * Calculate freeze frame durations based on narration length for each segment.
 * Adjusts freeze durations so the narration has time to complete.
 */
export function adjustDurationsForNarration(
  points: SyncPoint[],
  sectionDurations: { startTime: number; duration: number }[],
): SyncPoint[] {
  return points.map((point) => {
    if (point.type !== 'freeze') return point

    // Find the narration section that overlaps with this sync point
    const overlapping = sectionDurations.find(
      (s) =>
        s.startTime <= point.timestamp &&
        s.startTime + s.duration >= point.timestamp,
    )

    if (overlapping) {
      // Ensure freeze is long enough for the narration segment
      const neededDuration = overlapping.duration
      if (neededDuration > point.duration) {
        return { ...point, duration: neededDuration }
      }
    }

    return point
  })
}

/**
 * Insert transition sync points at major section breaks (page navigations).
 */
export function insertTransitionsAtBreaks(
  points: SyncPoint[],
  _timelineId: string,
): SyncPoint[] {
  const withTransitions = [...points]

  // Find navigate-type sync points and ensure they have transitions
  for (let i = 0; i < withTransitions.length; i++) {
    const point = withTransitions[i]
    if (point.type === 'transition' && !point.transitionType) {
      withTransitions[i] = { ...point, transitionType: 'fade' }
    }
  }

  return withTransitions
}
