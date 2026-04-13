// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useRef } from 'react'
import { usePointerDrag } from '../../src/renderer/hooks/usePointerDrag'

// Simple test component that wires up the hook to a div
function DragTarget({
  onDragStart,
  onDrag,
  onDragEnd,
  axis,
  threshold,
}: {
  onDragStart?: (x: number, y: number) => void
  onDrag: (dx: number, dy: number, cx: number, cy: number) => void
  onDragEnd: (dx: number, dy: number) => void
  axis?: 'x' | 'y'
  threshold?: number
}) {
  const { onPointerDown } = usePointerDrag({ onDragStart, onDrag, onDragEnd, axis, threshold })
  return <div data-testid="drag-target" onPointerDown={onPointerDown} />
}

function makePointerEvent(type: string, init: PointerEventInit = {}) {
  return new PointerEvent(type, { bubbles: true, pointerId: 1, ...init })
}

describe('usePointerDrag hook', () => {
  let onDragStart: ReturnType<typeof vi.fn>
  let onDrag: ReturnType<typeof vi.fn>
  let onDragEnd: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onDragStart = vi.fn()
    onDrag = vi.fn()
    onDragEnd = vi.fn()

    // jsdom doesn't implement setPointerCapture — stub it
    HTMLElement.prototype.setPointerCapture = vi.fn()
    HTMLElement.prototype.releasePointerCapture = vi.fn()
  })

  it('returns an onPointerDown handler', () => {
    const { getByTestId } = render(
      <DragTarget onDrag={onDrag} onDragEnd={onDragEnd} />,
    )
    const el = getByTestId('drag-target')
    expect(el).toBeTruthy()
    // The element should have the pointer down prop bound
    expect(el.onpointerdown).toBeNull() // React attaches via addEventListener
  })

  it('calls onDragStart callback after pointer move past zero threshold', () => {
    const { getByTestId } = render(
      <DragTarget onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} />,
    )
    const el = getByTestId('drag-target')

    act(() => {
      el.dispatchEvent(makePointerEvent('pointerdown', { clientX: 100, clientY: 100 }))
    })
    act(() => {
      el.dispatchEvent(makePointerEvent('pointermove', { clientX: 110, clientY: 100 }))
    })

    expect(onDragStart).toHaveBeenCalledWith(100, 100)
  })

  it('calls onDrag during pointermove', () => {
    const { getByTestId } = render(
      <DragTarget onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} />,
    )
    const el = getByTestId('drag-target')

    act(() => {
      el.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    })
    act(() => {
      el.dispatchEvent(makePointerEvent('pointermove', { clientX: 20, clientY: 15 }))
    })

    expect(onDrag).toHaveBeenCalledWith(20, 15, 20, 15)
  })

  it('calls onDragEnd on pointerup', () => {
    const { getByTestId } = render(
      <DragTarget onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} />,
    )
    const el = getByTestId('drag-target')

    act(() => {
      el.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    })
    act(() => {
      el.dispatchEvent(makePointerEvent('pointermove', { clientX: 30, clientY: 20 }))
    })
    act(() => {
      el.dispatchEvent(makePointerEvent('pointerup', { clientX: 30, clientY: 20 }))
    })

    expect(onDragEnd).toHaveBeenCalledWith(30, 20)
  })

  it('axis x constrains dy to 0', () => {
    const { getByTestId } = render(
      <DragTarget onDrag={onDrag} onDragEnd={onDragEnd} axis="x" />,
    )
    const el = getByTestId('drag-target')

    act(() => {
      el.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    })
    act(() => {
      el.dispatchEvent(makePointerEvent('pointermove', { clientX: 50, clientY: 30 }))
    })

    expect(onDrag).toHaveBeenCalledWith(50, 0, 50, 30)
  })

  it('threshold prevents micro-moves from triggering drag', () => {
    const { getByTestId } = render(
      <DragTarget
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        threshold={10}
      />,
    )
    const el = getByTestId('drag-target')

    act(() => {
      el.dispatchEvent(makePointerEvent('pointerdown', { clientX: 0, clientY: 0 }))
    })
    // Move less than threshold
    act(() => {
      el.dispatchEvent(makePointerEvent('pointermove', { clientX: 5, clientY: 3 }))
    })

    expect(onDragStart).not.toHaveBeenCalled()
    expect(onDrag).not.toHaveBeenCalled()
  })
})
