import { useRef, useCallback } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useOverlayEditorStore } from '../../stores/overlay-editor-store'
import type { TextOverlayElement as TextOverlayElementType } from '@shared/types'

interface TextOverlayElementProps {
  element: TextOverlayElementType
  segmentId: string
  isSelected: boolean
}

export function TextOverlayElement({ element, segmentId, isSelected }: TextOverlayElementProps): React.ReactNode {
  const setSelectedElement = useOverlayEditorStore((s) => s.setSelectedElement)
  const updateSegmentMetadata = useTimelineStore((s) => s.updateSegmentMetadata)

  const dragStartRef = useRef<{ x: number; y: number; elemX: number; elemY: number } | null>(null)
  const isDraggingRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedElement(element.id)
    dragStartRef.current = { x: e.clientX, y: e.clientY, elemX: element.x, elemY: element.y }
    isDraggingRef.current = false
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }, [element.id, element.x, element.y, setSelectedElement])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return
    const container = (e.currentTarget as HTMLDivElement).parentElement
    if (!container) return

    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y

    if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      isDraggingRef.current = true
    }
    if (!isDraggingRef.current) return

    const rect = container.getBoundingClientRect()
    const newX = Math.max(0, Math.min(100, dragStartRef.current.elemX + (dx / rect.width) * 100))
    const newY = Math.max(0, Math.min(100, dragStartRef.current.elemY + (dy / rect.height) * 100))

    const updatedElement = { ...element, x: newX, y: newY }
    updateSegmentMetadata(segmentId, JSON.stringify({ element: updatedElement }))
  }, [element, segmentId, updateSegmentMetadata])

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null
    isDraggingRef.current = false
  }, [])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    transform: 'translate(-50%, -50%)',
    fontFamily: element.fontFamily,
    fontSize: `${element.fontSize}px`,
    color: element.color,
    backgroundColor: hexToRgba(element.backgroundColor, element.backgroundOpacity),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '4px 8px',
    boxSizing: 'border-box',
    cursor: 'move',
    userSelect: 'none',
    outline: isSelected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
  }

  return (
    <div
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {element.text}
    </div>
  )
}

function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
