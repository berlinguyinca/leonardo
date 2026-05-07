import { describe, it, expect } from 'vitest'
import {
  calculateFreezeFrame,
  type FreezeFrameInput,
} from '../../src/main/services/ai/freeze-frame-calculator'

describe('calculateFreezeFrame', () => {
  // 1. Short text that fits within the event gap → needed: false
  it('returns needed: false when narration fits within event gap', () => {
    // 10 words at 150 wpm = 4 seconds narration; gap is 6s → no freeze needed
    const input: FreezeFrameInput = {
      scriptText: 'one two three four five six seven eight nine ten',
      eventGapSeconds: 6,
    }
    const result = calculateFreezeFrame(input)
    expect(result.needed).toBe(false)
    expect(result.duration).toBe(0)
    expect(result.overridden).toBe(false)
  })

  // 2. Long text exceeding event gap → needed: true, positive duration
  it('returns needed: true with positive duration when narration exceeds event gap', () => {
    // 75 words at 150 wpm = 30 seconds narration; gap is 5s → freeze = 25s
    const words = Array.from({ length: 75 }, (_, i) => `word${i}`).join(' ')
    const input: FreezeFrameInput = {
      scriptText: words,
      eventGapSeconds: 5,
    }
    const result = calculateFreezeFrame(input)
    expect(result.needed).toBe(true)
    expect(result.duration).toBeGreaterThan(0)
    expect(result.overridden).toBe(false)
  })

  // 3. User override with positive value → overridden: true, uses override duration
  it('uses override duration when freezeOverride is a positive number', () => {
    const input: FreezeFrameInput = {
      scriptText: 'short text',
      eventGapSeconds: 0,
      freezeOverride: 3.5,
    }
    const result = calculateFreezeFrame(input)
    expect(result.needed).toBe(true)
    expect(result.duration).toBe(3.5)
    expect(result.overridden).toBe(true)
  })

  // 4. User override with 0 → needed: false, overridden: true
  it('returns needed: false when freezeOverride is 0', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    const input: FreezeFrameInput = {
      scriptText: words,
      eventGapSeconds: 0,
      freezeOverride: 0,
    }
    const result = calculateFreezeFrame(input)
    expect(result.needed).toBe(false)
    expect(result.duration).toBe(0)
    expect(result.overridden).toBe(true)
  })

  // 5. User override with null → uses calculated value
  it('falls back to calculated value when freezeOverride is null', () => {
    // 75 words at 150 wpm = 30s; gap = 5s → calculated = 25s
    const words = Array.from({ length: 75 }, (_, i) => `word${i}`).join(' ')
    const input: FreezeFrameInput = {
      scriptText: words,
      eventGapSeconds: 5,
      freezeOverride: null,
    }
    const result = calculateFreezeFrame(input)
    expect(result.overridden).toBe(false)
    expect(result.duration).toBe(result.calculated)
    expect(result.needed).toBe(true)
  })

  // 6. Empty text → needed: false
  it('returns needed: false for empty scriptText', () => {
    const input: FreezeFrameInput = {
      scriptText: '',
      eventGapSeconds: 0,
    }
    const result = calculateFreezeFrame(input)
    expect(result.needed).toBe(false)
    expect(result.duration).toBe(0)
    expect(result.calculated).toBe(0)
    expect(result.overridden).toBe(false)
  })

  // 7. Custom WPM value changes calculation
  it('uses custom wpm to compute narration duration', () => {
    // 30 words at 300 wpm = 6s narration; gap = 4s → freeze = 2s
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ')
    const inputSlow: FreezeFrameInput = {
      scriptText: words,
      eventGapSeconds: 4,
      wpm: 300,
    }
    const resultSlow = calculateFreezeFrame(inputSlow)
    // 30 words at 150 wpm = 12s narration; gap = 4s → freeze = 8s
    const inputFast: FreezeFrameInput = {
      scriptText: words,
      eventGapSeconds: 4,
      wpm: 150,
    }
    const resultFast = calculateFreezeFrame(inputFast)
    // Higher WPM = shorter narration = less freeze needed
    expect(resultSlow.duration).toBeLessThan(resultFast.duration)
  })

  // 8. Duration rounds to nearest 0.5 seconds
  it('rounds calculated duration to nearest 0.5 seconds', () => {
    // Craft a case where raw result is not a multiple of 0.5
    // 7 words at 150 wpm = 2.8s narration; gap = 0s → calculated raw = 2.8 → rounded = 3.0
    const input: FreezeFrameInput = {
      scriptText: 'one two three four five six seven',
      eventGapSeconds: 0,
    }
    const result = calculateFreezeFrame(input)
    // Result should be a multiple of 0.5
    expect(result.calculated % 0.5).toBe(0)
    expect(result.duration % 0.5).toBe(0)
  })

  // Bonus: whitespace-only scriptText treated as empty
  it('treats whitespace-only scriptText as empty', () => {
    const input: FreezeFrameInput = {
      scriptText: '   \t\n  ',
      eventGapSeconds: 0,
    }
    const result = calculateFreezeFrame(input)
    expect(result.needed).toBe(false)
    expect(result.duration).toBe(0)
  })
})
