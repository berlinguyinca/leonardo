import { useCallback, useRef, useState } from 'react'
import type { Segment as SegmentType, TrackType } from '@shared/types'
import { parseOverlayMetadata } from '@shared/types'
import type { OverlayType } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { useScriptStore } from '../../stores/script-store'
import { usePointerDrag } from '../../hooks/usePointerDrag'
import { timeToPixel } from './timeline-utils'
import { ThumbnailStrip } from './ThumbnailStrip'
import { SegmentContextMenu } from './SegmentContextMenu'

const OVERLAY_COLORS: Record<OverlayType, string> = {
  intro: '#3b82f6',
  exit: '#ef4444',
  title: '#f59e0b',
  section: '#8b5cf6',
}

interface SegmentProps {
  segment: SegmentType
  trackType?: TrackType
  zoomLevel: number
  scrollOffset: number
  snapTargets: number[]
}

export function Segment({ segment, trackType, zoomLevel, scrollOffset, snapTargets: _snapTargets }: SegmentProps): React.ReactNode {
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)
  const setSelectedSegment = useTimelineStore((s) => s.setSelectedSegment)
  const updateSegmentTiming = useTimelineStore((s) => s.updateSegmentTiming)
  const clips = useLibraryStore((s) => s.clips)
  const clipScripts = useScriptStore((s) => s.clipScripts)
  const isSelected = selectedSegmentId === segment.id

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const left = timeToPixel(segment.startTime, zoomLevel, scrollOffset)
  const width = timeToPixel(segment.endTime, zoomLevel, scrollOffset) - left

  const clip = clips.find((c) => c.filePath === segment.sourceFile)

  const isOverlay = trackType === 'overlay'
  const overlayMeta = isOverlay ? parseOverlayMetadata(segment) : null
  const overlayType = overlayMeta?.element?.overlayType ?? null
  const overlayColor = overlayType ? OVERLAY_COLORS[overlayType] : undefined

  // Track live timing during edge drags without committing to store each frame
  const liveTimingRef = useRef({ startTime: segment.startTime, endTime: segment.endTime })
  liveTimingRef.current = { startTime: segment.startTime, endTime: segment.endTime }

  const handleClick = useCallback(
    () => {
      setSelectedSegment(segment.id)
    },
    [segment.id, setSelectedSegment],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setSelectedSegment(segment.id)
      setContextMenu({ x: e.clientX, y: e.clientY })
    },
    [segment.id, setSelectedSegment],
  )

  const { onPointerDown } = usePointerDrag({
    axis: 'x',
    threshold: 3,
    onDrag: () => {},
    onDragEnd: () => {},
  })

  const { onPointerDown: onLeftEdgePointerDown } = usePointerDrag({
    axis: 'x',
    threshold: 0,
    onDrag: (dx) => {
      if (!isOverlay) return
      const deltaMs = (dx / (100 * zoomLevel)) * 1000
      const newStart = Math.max(0, liveTimingRef.current.startTime + deltaMs)
      const newEnd = liveTimingRef.current.endTime
      if (newEnd - newStart >= 100) {
        updateSegmentTiming(segment.id, newStart, newEnd)
      }
    },
    onDragEnd: () => {},
  })

  const { onPointerDown: onRightEdgePointerDown } = usePointerDrag({
    axis: 'x',
    threshold: 0,
    onDrag: (dx) => {
      if (!isOverlay) return
      const deltaMs = (dx / (100 * zoomLevel)) * 1000
      const newStart = liveTimingRef.current.startTime
      const newEnd = Math.max(newStart + 100, liveTimingRef.current.endTime + deltaMs)
      updateSegmentTiming(segment.id, newStart, newEnd)
    },
    onDragEnd: () => {},
  })


  return (
    <div
      className={`timeline-segment ${isSelected ? 'selected' : ''}${isOverlay ? ' overlay-segment' : ''}`}
      style={{
        left,
        width: Math.max(width, 4),
        ...(overlayColor ? { backgroundColor: overlayColor, borderColor: overlayColor } : {}),
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={onPointerDown}
      data-segment-id={segment.id}
      data-overlay-type={overlayType ?? undefined}
    >
      {clip && <ThumbnailStrip clipId={clip.id} widthPx={Math.max(width, 4)} />}
      {overlayType && (
        <span className="overlay-type-badge" data-testid="overlay-type-badge">
          {overlayType}
        </span>
      )}
      <div className="segment-label">{segment.label}</div>
      {clip && clipScripts[clip.id]?.[0] && (
        <p className="segment-script-preview">
          {clipScripts[clip.id][0].text.slice(0, 80)}
        </p>
      )}
      <div
        className="segment-edge segment-edge-left"
        onPointerDown={isOverlay ? onLeftEdgePointerDown : undefined}
        data-testid="segment-edge-left"
      />
      <div
        className="segment-edge segment-edge-right"
        onPointerDown={isOverlay ? onRightEdgePointerDown : undefined}
        data-testid="segment-edge-right"
      />
      {contextMenu && (
        <SegmentContextMenu
          segment={segment}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
