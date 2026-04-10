import { useCallback, useRef } from 'react'

export interface PointerDragOptions {
  onDrag: (dx: number, dy: number, clientX: number, clientY: number) => void
  onDragEnd: (dx: number, dy: number) => void
  onDragStart?: (clientX: number, clientY: number) => void
  axis?: 'x' | 'y'
  threshold?: number
}

export function usePointerDrag(options: PointerDragOptions) {
  const startPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const hasStarted = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    startPos.current = { x: e.clientX, y: e.clientY }
    isDragging.current = true
    hasStarted.current = false

    const threshold = optionsRef.current.threshold ?? 0

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return

      let dx = e.clientX - startPos.current.x
      let dy = e.clientY - startPos.current.y

      if (!hasStarted.current) {
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return
        hasStarted.current = true
        optionsRef.current.onDragStart?.(startPos.current.x, startPos.current.y)
      }

      if (optionsRef.current.axis === 'x') dy = 0
      if (optionsRef.current.axis === 'y') dx = 0

      optionsRef.current.onDrag(dx, dy, e.clientX, e.clientY)
    }

    const handlePointerUp = (e: PointerEvent) => {
      isDragging.current = false
      let dx = e.clientX - startPos.current.x
      let dy = e.clientY - startPos.current.y
      if (optionsRef.current.axis === 'x') dy = 0
      if (optionsRef.current.axis === 'y') dx = 0

      if (hasStarted.current) {
        optionsRef.current.onDragEnd(dx, dy)
      }

      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
  }, [])

  return { onPointerDown: handlePointerDown }
}
