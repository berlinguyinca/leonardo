import type { Track, SyncPoint } from '@shared/types'
import { TrackHeader } from './TrackHeader'
import { Segment } from './Segment'
import { SyncPointMarker } from './SyncPointMarker'

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

  return (
    <div className="track-lane" data-track-id={track.id}>
      <TrackHeader track={track} onToggleMute={onToggleMute} onToggleLock={onToggleLock} />
      <div className="track-content">
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
