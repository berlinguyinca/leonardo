// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import React from 'react'
import { ResizeDivider } from '@renderer/components/script-editor/ResizeDivider'

describe('ResizeDivider', () => {
  it('renders a div element with the correct CSS class', () => {
    const { container } = render(<ResizeDivider onResize={vi.fn()} />)
    const el = container.querySelector('.resize-divider-v')
    expect(el).not.toBeNull()
    expect(el?.tagName.toLowerCase()).toBe('div')
  })

  it('has resize-divider-v class for vertical orientation', () => {
    const { container } = render(<ResizeDivider onResize={vi.fn()} />)
    expect(container.firstElementChild?.classList.contains('resize-divider-v')).toBe(true)
  })

  it('calls onResize with the correct delta during pointer drag', () => {
    const onResize = vi.fn()
    const { container } = render(<ResizeDivider onResize={onResize} />)
    const el = container.querySelector('.resize-divider-v') as HTMLElement

    // Stub setPointerCapture so jsdom does not throw
    el.setPointerCapture = vi.fn()

    // Pointer down at x=100
    fireEvent.pointerDown(el, { clientX: 100, pointerId: 1 })

    // Pointer move to x=150 → delta = +50
    fireEvent.pointerMove(el, { clientX: 150, pointerId: 1 })

    expect(onResize).toHaveBeenCalledWith(50)

    // Pointer move again to x=160 → delta = +10 (startX updated to 150)
    fireEvent.pointerMove(el, { clientX: 160, pointerId: 1 })

    expect(onResize).toHaveBeenCalledWith(10)
    expect(onResize).toHaveBeenCalledTimes(2)
  })
})
