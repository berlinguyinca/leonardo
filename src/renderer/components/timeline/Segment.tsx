import { useCallback } from 'react'
import type { Segment as SegmentType } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { usePointerDrag } from '../../hooks/usePointerDrag'
import { timeToPixel } from './timeline-utils'
import { ThumbnailStrip } from './ThumbnailStrip'

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
  const isSelected = selectedSegmentId === segment.id

  const left = timeToPixel(segment.startTime, zoomLevel, scrollOffset)
  const width = timeToPixel(segment.endTime, zoomLevel, scrollOffset) - left

  const clip = clips.find((c) => c.filePath === segment.sourceFile)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedSegment(segment.id)
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
      onPointerDown={onPointerDown}
      data-segment-id={segment.id}
    >
      {clip && <ThumbnailStrip clipId={clip.id} widthPx={Math.max(width, 4)} />}
      <div className="segment-label">{segment.label}</div>
      <div className="segment-edge segment-edge-left" />
      <div className="segment-edge segment-edge-right" />
    </div>
  )
}
