import { describe, it, expect } from 'vitest'
import { RESOLUTION_PRESETS, type Resolution } from '@shared/types/project'

describe('resolution management', () => {
  it('provides 1080p preset', () => {
    const res = RESOLUTION_PRESETS['1080p']
    expect(res.width).toBe(1920)
    expect(res.height).toBe(1080)
    expect(res.label).toBe('1080p')
  })

  it('provides 1440p preset', () => {
    const res = RESOLUTION_PRESETS['1440p']
    expect(res.width).toBe(2560)
    expect(res.height).toBe(1440)
    expect(res.label).toBe('1440p')
  })

  it('provides 4K preset', () => {
    const res = RESOLUTION_PRESETS['4K']
    expect(res.width).toBe(3840)
    expect(res.height).toBe(2160)
    expect(res.label).toBe('4K')
  })

  it('all presets maintain 16:9 aspect ratio', () => {
    for (const [label, res] of Object.entries(RESOLUTION_PRESETS)) {
      const ratio = res.width / res.height
      expect(ratio).toBeCloseTo(16 / 9, 1)
    }
  })

  it('presets are ordered by size', () => {
    const presets = Object.values(RESOLUTION_PRESETS)
    for (let i = 1; i < presets.length; i++) {
      expect(presets[i].width).toBeGreaterThan(presets[i - 1].width)
      expect(presets[i].height).toBeGreaterThan(presets[i - 1].height)
    }
  })

  it('calculates DPI-scaled dimensions correctly', () => {
    // Simulate DPI scaling: 2x Retina display
    const dpr = 2
    const res = RESOLUTION_PRESETS['1080p']

    // The webview CSS size should be the target resolution / DPR
    // to get actual pixel capture at target resolution
    const cssWidth = res.width / dpr
    const cssHeight = res.height / dpr
    expect(cssWidth).toBe(960)
    expect(cssHeight).toBe(540)

    // At 2x DPR, 960x540 CSS pixels = 1920x1080 device pixels
    expect(cssWidth * dpr).toBe(res.width)
    expect(cssHeight * dpr).toBe(res.height)
  })
})
