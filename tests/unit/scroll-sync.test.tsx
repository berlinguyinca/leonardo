// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useScrollSync } from '../../src/renderer/hooks/useScrollSync'

function makeScrollableEl(scrollTop: number, scrollHeight: number, clientHeight: number) {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollTop', {
    writable: true,
    value: scrollTop,
  })
  Object.defineProperty(el, 'scrollHeight', {
    get: () => scrollHeight,
  })
  Object.defineProperty(el, 'clientHeight', {
    get: () => clientHeight,
  })
  return el
}

describe('useScrollSync hook', () => {
  beforeEach(() => {
    // Stub requestAnimationFrame so isScrolling resets synchronously
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
  })

  it('syncs scrollTop proportionally from source to target', () => {
    const source = makeScrollableEl(50, 200, 100) // scrollTop=50, max=100
    const target = makeScrollableEl(0, 400, 100)  // max=300

    const sourceRef = { current: source }
    const targetRef = { current: target }

    const { result } = renderHook(() => useScrollSync(sourceRef, targetRef))

    act(() => {
      result.current.syncScroll()
    })

    // ratio = 50/100 = 0.5; target.scrollTop = 0.5 * 300 = 150
    expect(target.scrollTop).toBe(150)
  })

  it('does nothing when source ref is null', () => {
    const target = makeScrollableEl(0, 400, 100)
    const sourceRef = { current: null }
    const targetRef = { current: target }

    const { result } = renderHook(() => useScrollSync(sourceRef, targetRef))

    act(() => {
      result.current.syncScroll()
    })

    expect(target.scrollTop).toBe(0)
  })

  it('does nothing when target ref is null', () => {
    const source = makeScrollableEl(50, 200, 100)
    const sourceRef = { current: source }
    const targetRef = { current: null }

    const { result } = renderHook(() => useScrollSync(sourceRef, targetRef))

    // Should not throw
    act(() => {
      result.current.syncScroll()
    })
  })

  it('prevents recursive scroll events via isScrolling guard', () => {
    const source = makeScrollableEl(50, 200, 100)
    const target = makeScrollableEl(0, 400, 100)

    const sourceRef = { current: source }
    const targetRef = { current: target }

    // Prevent the RAF from running so isScrolling stays true during the second call
    let rafCallback: FrameRequestCallback | null = null
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb
      return 0
    })

    const { result } = renderHook(() => useScrollSync(sourceRef, targetRef))

    act(() => {
      // First call sets isScrolling = true
      result.current.syncScroll()
      // Second call is a no-op because isScrolling is still true
      target.scrollTop = 0  // reset to detect if second call wrote to it
      result.current.syncScroll()
    })

    // Target was reset before the second call; if guard works, scrollTop stays 0
    expect(target.scrollTop).toBe(0)

    // Unblock the RAF
    act(() => {
      rafCallback?.(0)
    })
  })
})
