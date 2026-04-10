import { describe, it, expect } from 'vitest'
import { computeZoomScrollOffset } from '@renderer/hooks/useTimelineZoom'

describe('computeZoomScrollOffset', () => {
  it('keeps cursor position stable when zooming in', () => {
    const result = computeZoomScrollOffset(200, 0, 1, 2)
    expect(result).toBe(200)
  })

  it('keeps cursor position stable when zooming out', () => {
    const result = computeZoomScrollOffset(200, 200, 2, 1)
    expect(result).toBe(0)
  })

  it('returns 0 when result would be negative', () => {
    const result = computeZoomScrollOffset(50, 0, 2, 1)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('handles extreme zoom values', () => {
    const result = computeZoomScrollOffset(500, 0, 1, 10)
    expect(result).toBe(4500)
  })
})
