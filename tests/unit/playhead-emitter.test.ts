import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playheadEmitter } from '@renderer/hooks/PlayheadEmitter'

describe('PlayheadEmitter', () => {
  beforeEach(() => {
    playheadEmitter.all.clear()
  })

  it('emits position to subscribers', () => {
    const handler = vi.fn()
    playheadEmitter.on('position', handler)
    playheadEmitter.emit('position', 5000)
    expect(handler).toHaveBeenCalledWith(5000)
  })

  it('supports multiple subscribers', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    playheadEmitter.on('position', h1)
    playheadEmitter.on('position', h2)
    playheadEmitter.emit('position', 3000)
    expect(h1).toHaveBeenCalledWith(3000)
    expect(h2).toHaveBeenCalledWith(3000)
  })

  it('stops receiving after unsubscribe', () => {
    const handler = vi.fn()
    playheadEmitter.on('position', handler)
    playheadEmitter.off('position', handler)
    playheadEmitter.emit('position', 1000)
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not leak between tests when cleared', () => {
    const handler = vi.fn()
    playheadEmitter.emit('position', 999)
    expect(handler).not.toHaveBeenCalled()
  })
})
