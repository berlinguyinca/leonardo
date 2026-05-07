import { useRef, useCallback } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useOverlayEditorStore } from '../../stores/overlay-editor-store'
import type { TextOverlayElement as TextOverlayElementType } from '@shared/types'

interface TextOverlayElementProps {
  element: TextOverlayElementType
  segmentId: string
  isSelected: boolean
}

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface ResizeStart {
  clientX: number
  clientY: number
  elemX: number
  elemY: number
  elemWidth: number
  elemHeight: number
  corner: ResizeCorner
}

export function TextOverlayElement({ element, segmentId, isSelected }: TextOverlayElementProps): React.ReactNode {
  const setSelectedElement = useOverlayEditorStore((s) => s.setSelectedElement)
  const updateSegmentMetadata = useTimelineStore((s) => s.updateSegmentMetadata)

  const dragStartRef = useRef<{ x: number; y: number; elemX: number; elemY: number } | null>(null)
  const isDraggingRef = useRef(false)
  const resizeStartRef = useRef<ResizeStart | null>(null)

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

  const handleResizePointerDown = useCallback((corner: ResizeCorner) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelectedElement(element.id)
    resizeStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      elemX: element.x,
      elemY: element.y,
      elemWidth: element.width,
      elemHeight: element.height,
      corner,
    }
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
  }, [element.id, element.x, element.y, element.width, element.height, setSelectedElement])

  const handleResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return
    const container = (e.currentTarget as HTMLDivElement).closest('[data-overlay-canvas]') as HTMLElement | null
    if (!container) return

    const rect = container.getBoundingClientRect()
    const dx = ((e.clientX - resizeStartRef.current.clientX) / rect.width) * 100
    const dy = ((e.clientY - resizeStartRef.current.clientY) / rect.height) * 100
    const { elemX, elemY, elemWidth, elemHeight, corner } = resizeStartRef.current

    let newX = elemX
    let newY = elemY
    let newWidth = elemWidth
    let newHeight = elemHeight

    if (corner === 'bottom-right') {
      newWidth = Math.max(10, elemWidth + dx)
      newHeight = Math.max(5, elemHeight + dy)
    } else if (corner === 'bottom-left') {
      newWidth = Math.max(10, elemWidth - dx)
      newHeight = Math.max(5, elemHeight + dy)
      newX = elemX + (elemWidth - newWidth)
    } else if (corner === 'top-right') {
      newWidth = Math.max(10, elemWidth + dx)
      newHeight = Math.max(5, elemHeight - dy)
      newY = elemY + (elemHeight - newHeight)
    } else {
      // top-left
      newWidth = Math.max(10, elemWidth - dx)
      newHeight = Math.max(5, elemHeight - dy)
      newX = elemX + (elemWidth - newWidth)
      newY = elemY + (elemHeight - newHeight)
    }

    const updatedElement = { ...element, x: newX, y: newY, width: newWidth, height: newHeight }
    updateSegmentMetadata(segmentId, JSON.stringify({ element: updatedElement }))
  }, [element, segmentId, updateSegmentMetadata])

  const handleResizePointerUp = useCallback(() => {
    if (!resizeStartRef.current) return
    resizeStartRef.current = null
    // Persist final state — updateSegmentMetadata called on last move already persisted it
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

  const gripStyle = (cursor: string, pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    width: 8,
    height: 8,
    background: '#3b82f6',
    border: '1px solid #fff',
    borderRadius: 1,
    cursor,
    ...pos,
  })

  return (
    <div
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {element.text}
      {isSelected && (
        <>
          <div
            data-resize-corner="top-left"
            style={gripStyle('nw-resize', { top: -5, left: -5 })}
            onPointerDown={handleResizePointerDown('top-left')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-resize-corner="top-right"
            style={gripStyle('ne-resize', { top: -5, right: -5 })}
            onPointerDown={handleResizePointerDown('top-right')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-resize-corner="bottom-left"
            style={gripStyle('sw-resize', { bottom: -5, left: -5 })}
            onPointerDown={handleResizePointerDown('bottom-left')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-resize-corner="bottom-right"
            style={gripStyle('se-resize', { bottom: -5, right: -5 })}
            onPointerDown={handleResizePointerDown('bottom-right')}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
        </>
      )}
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  let clean = hex.replace('#', '')
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('')
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0,0,0,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}
