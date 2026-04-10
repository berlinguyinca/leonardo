import { describe, it, expect } from 'vitest'
import {
  timeToPixel,
  pixelToTime,
  findSnapTarget,
  detectOverlap,
  getGridInterval,
} from '@renderer/components/timeline/timeline-utils'

describe('timeToPixel', () => {
  it('converts time to pixel at 1x zoom', () => {
    expect(timeToPixel(1000, 1, 0)).toBe(100)
  })
  it('applies zoom multiplier', () => {
    expect(timeToPixel(1000, 2, 0)).toBe(200)
  })
  it('subtracts scroll offset', () => {
    expect(timeToPixel(1000, 1, 50)).toBe(50)
  })
  it('handles zero time', () => {
    expect(timeToPixel(0, 1, 0)).toBe(0)
  })
  it('handles extreme zoom', () => {
    expect(timeToPixel(1000, 10, 0)).toBe(1000)
  })
})

describe('pixelToTime', () => {
  it('converts pixel to time at 1x zoom', () => {
    expect(pixelToTime(100, 1, 0)).toBe(1000)
  })
  it('applies zoom divisor', () => {
    expect(pixelToTime(200, 2, 0)).toBe(1000)
  })
  it('adds scroll offset', () => {
    expect(pixelToTime(50, 1, 50)).toBe(1000)
  })
  it('handles zero pixel', () => {
    expect(pixelToTime(0, 1, 0)).toBe(0)
  })
  it('is inverse of timeToPixel', () => {
    const time = 5000
    const zoom = 2.5
    const scroll = 100
    const px = timeToPixel(time, zoom, scroll)
    expect(pixelToTime(px, zoom, scroll)).toBeCloseTo(time)
  })
})

describe('findSnapTarget', () => {
  it('snaps to nearest target within threshold', () => {
    const targets = [1000, 3000, 5000]
    expect(findSnapTarget(1005, targets, 10)).toBe(1000)
  })
  it('returns null when no target within threshold', () => {
    expect(findSnapTarget(2000, [1000, 3000, 5000], 10)).toBeNull()
  })
  it('snaps to closest when multiple in range', () => {
    expect(findSnapTarget(1003, [1000, 1008], 10)).toBe(1000)
  })
  it('handles empty targets', () => {
    expect(findSnapTarget(1000, [], 10)).toBeNull()
  })
  it('snaps to exact match', () => {
    expect(findSnapTarget(2000, [1000, 2000], 10)).toBe(2000)
  })
})

describe('detectOverlap', () => {
  it('detects overlapping segments', () => {
    const segment = { startTime: 1000, endTime: 3000 }
    const others = [
      { id: 's1', startTime: 2000, endTime: 4000 },
      { id: 's2', startTime: 5000, endTime: 6000 },
    ]
    expect(detectOverlap(segment, others)).toEqual(['s1'])
  })
  it('returns empty for non-overlapping', () => {
    const segment = { startTime: 1000, endTime: 2000 }
    const others = [{ id: 's1', startTime: 3000, endTime: 4000 }]
    expect(detectOverlap(segment, others)).toEqual([])
  })
  it('detects full containment', () => {
    const segment = { startTime: 1000, endTime: 5000 }
    const others = [{ id: 's1', startTime: 2000, endTime: 3000 }]
    expect(detectOverlap(segment, others)).toEqual(['s1'])
  })
  it('does not count touching edges as overlap', () => {
    const segment = { startTime: 1000, endTime: 2000 }
    const others = [{ id: 's1', startTime: 2000, endTime: 3000 }]
    expect(detectOverlap(segment, others)).toEqual([])
  })
  it('handles empty others', () => {
    expect(detectOverlap({ startTime: 1000, endTime: 2000 }, [])).toEqual([])
  })
})

describe('getGridInterval', () => {
  it('returns 500ms at 1x zoom', () => {
    expect(getGridInterval(1)).toBe(500)
  })
  it('returns 100ms at 5x zoom', () => {
    expect(getGridInterval(5)).toBe(100)
  })
  it('returns 1000ms at 0.5x zoom', () => {
    expect(getGridInterval(0.5)).toBe(1000)
  })
  it('returns 2000ms at 0.25x zoom', () => {
    expect(getGridInterval(0.25)).toBe(2000)
  })
  it('returns 50ms at 10x zoom', () => {
    expect(getGridInterval(10)).toBe(50)
  })
})
