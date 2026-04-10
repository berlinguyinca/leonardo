import { useCallback, useRef } from 'react'

interface ResizeDividerProps {
  onResize: (delta: number) => void
}

export function ResizeDivider({ onResize }: ResizeDividerProps): React.ReactNode {
  const startX = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      startX.current = e.clientX

      const handleMove = (e: PointerEvent) => {
        const delta = e.clientX - startX.current
        startX.current = e.clientX
        onResize(delta)
      }

      const handleUp = () => {
        target.removeEventListener('pointermove', handleMove)
        target.removeEventListener('pointerup', handleUp)
      }

      target.addEventListener('pointermove', handleMove)
      target.addEventListener('pointerup', handleUp)
    },
    [onResize],
  )

  return <div className="resize-divider-v" onPointerDown={handlePointerDown} />
}
