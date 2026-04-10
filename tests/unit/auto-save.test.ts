import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startAutoSave, stopAutoSave, markDirty, flushSave } from '@main/services/auto-save'

describe('auto-save', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stopAutoSave()
  })

  afterEach(() => {
    stopAutoSave()
    vi.useRealTimers()
  })

  it('calls save callback when dirty after interval', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)
    markDirty()

    vi.advanceTimersByTime(30_000)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('does not call save callback when not dirty', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)

    vi.advanceTimersByTime(30_000)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('resets dirty flag after saving', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)
    markDirty()

    vi.advanceTimersByTime(30_000)
    expect(saveFn).toHaveBeenCalledTimes(1)

    // Next interval: no longer dirty
    vi.advanceTimersByTime(30_000)
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('saves on consecutive dirty intervals', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)

    markDirty()
    vi.advanceTimersByTime(30_000)
    expect(saveFn).toHaveBeenCalledTimes(1)

    markDirty()
    vi.advanceTimersByTime(30_000)
    expect(saveFn).toHaveBeenCalledTimes(2)
  })

  it('flushSave triggers immediate save when dirty', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)
    markDirty()

    flushSave()
    expect(saveFn).toHaveBeenCalledTimes(1)
  })

  it('flushSave is a no-op when not dirty', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)

    flushSave()
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('stopAutoSave prevents further saves', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)
    markDirty()
    stopAutoSave()

    vi.advanceTimersByTime(60_000)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('does not start duplicate intervals', () => {
    const saveFn = vi.fn()
    startAutoSave(saveFn)
    startAutoSave(saveFn)
    markDirty()

    vi.advanceTimersByTime(30_000)
    // Only one interval active, so only one call
    expect(saveFn).toHaveBeenCalledTimes(1)
  })
})
