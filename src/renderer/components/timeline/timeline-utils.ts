import { TIMELINE_SNAP_THRESHOLD_PX } from '@shared/constants'

const PIXELS_PER_SECOND = 100

export function timeToPixel(timeMs: number, zoom: number, scrollOffset: number): number {
  return (timeMs / 1000) * PIXELS_PER_SECOND * zoom - scrollOffset
}

export function pixelToTime(px: number, zoom: number, scrollOffset: number): number {
  return ((px + scrollOffset) / (PIXELS_PER_SECOND * zoom)) * 1000
}

export function findSnapTarget(
  position: number,
  targets: number[],
  threshold: number = TIMELINE_SNAP_THRESHOLD_PX,
): number | null {
  let closest: number | null = null
  let closestDist = Infinity
  for (const target of targets) {
    const dist = Math.abs(position - target)
    if (dist <= threshold && dist < closestDist) {
      closest = target
      closestDist = dist
    }
  }
  return closest
}

interface TimeRange {
  startTime: number
  endTime: number
}

interface IdentifiedTimeRange extends TimeRange {
  id: string
}

export function detectOverlap(
  segment: TimeRange,
  others: IdentifiedTimeRange[],
): string[] {
  return others
    .filter((other) => segment.startTime < other.endTime && segment.endTime > other.startTime)
    .map((other) => other.id)
}

export function getGridInterval(zoom: number): number {
  const base = 500
  return Math.max(50, Math.round(base / zoom))
}
