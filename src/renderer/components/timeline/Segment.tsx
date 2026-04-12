import { useCallback, useState } from 'react'
import type { Segment as SegmentType } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { useScriptStore } from '../../stores/script-store'
import { usePointerDrag } from '../../hooks/usePointerDrag'
import { timeToPixel } from './timeline-utils'
import { ThumbnailStrip } from './ThumbnailStrip'
import { SegmentContextMenu } from './SegmentContextMenu'

interface SegmentProps {
  segment: SegmentType
  zoomLevel: number
  scrollOffset: number
  snapTargets: number[]
}

export function Segment({ segment, zoomLevel, scrollOffset, snapTargets: _snapTargets }: SegmentProps): React.ReactNode {
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)
  const setSelectedSegment = useTimelineStore((s) => s.setSelectedSegment)
  const clips = useLibraryStore((s) => s.clips)
  const clipScripts = useScriptStore((s) => s.clipScripts)
  const isSelected = selectedSegmentId === segment.id

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const left = timeToPixel(segment.startTime, zoomLevel, scrollOffset)
  const width = timeToPixel(segment.endTime, zoomLevel, scrollOffset) - left

  const clip = clips.find((c) => c.filePath === segment.sourceFile)

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

  return (
    <div
      className={`timeline-segment ${isSelected ? 'selected' : ''}`}
      style={{ left, width: Math.max(width, 4) }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={onPointerDown}
      data-segment-id={segment.id}
    >
      {clip && <ThumbnailStrip clipId={clip.id} widthPx={Math.max(width, 4)} />}
      <div className="segment-label">{segment.label}</div>
      {clip && clipScripts[clip.id]?.[0] && (
        <p className="segment-script-preview">
          {clipScripts[clip.id][0].text.slice(0, 80)}
        </p>
      )}
      <div className="segment-edge segment-edge-left" />
      <div className="segment-edge segment-edge-right" />
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
