import { useRef } from 'react'
import type { Track, SyncPoint } from '@shared/types'
import { TrackHeader } from './TrackHeader'
import { Segment } from './Segment'
import { SyncPointMarker } from './SyncPointMarker'
import { pixelToTime } from './timeline-utils'
import { useLibraryStore } from '../../stores/library-store'
import { useTimelineStore } from '../../stores/timeline-store'

interface TrackLaneProps {
  track: Track
  syncPoints: SyncPoint[]
  zoomLevel: number
  scrollOffset: number
  onToggleMute: () => void
  onToggleLock: () => void
}

export function TrackLane({
  track,
  syncPoints,
  zoomLevel,
  scrollOffset,
  onToggleMute,
  onToggleLock,
}: TrackLaneProps): React.ReactNode {
  const snapTargets = track.segments.flatMap((s) => [s.startTime, s.endTime])
  const trackContentRef = useRef<HTMLDivElement>(null)
  const clips = useLibraryStore((state) => state.clips)
  const addClipToTimeline = useTimelineStore((state) => state.addClipToTimeline)

  function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    const clipId = e.dataTransfer.getData('application/clip-id')
    const clip = clips.find((c) => c.id === clipId)
    if (!clip) return

    const rect = trackContentRef.current?.getBoundingClientRect()
    if (!rect) return

    const insertTime = pixelToTime(e.clientX - rect.left, zoomLevel, scrollOffset)
    addClipToTimeline(clip, insertTime)
  }

  return (
    <div className="track-lane" data-track-id={track.id}>
      <TrackHeader track={track} onToggleMute={onToggleMute} onToggleLock={onToggleLock} />
      <div
        className="track-content"
        ref={trackContentRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {track.segments.map((seg) => (
          <Segment
            key={seg.id}
            segment={seg}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
            snapTargets={snapTargets}
          />
        ))}
        {syncPoints.map((sp) => (
          <SyncPointMarker
            key={sp.id}
            syncPoint={sp}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
          />
        ))}
      </div>
    </div>
  )
}
