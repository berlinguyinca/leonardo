import { useTimelineStore } from '../../stores/timeline-store'
import { SYNC_POINT_COLORS } from '@shared/constants'

export function TimelineMinimap(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)

  if (!timeline || timeline.duration === 0) {
    return <div className="timeline-minimap">No timeline</div>
  }

  const duration = timeline.duration

  return (
    <div className="timeline-minimap">
      {timeline.tracks.map((track) => (
        <div key={track.id} className="minimap-track">
          <span className="minimap-track-label">{track.label}</span>
          <div className="minimap-track-bar">
            {track.segments.map((seg) => (
              <div
                key={seg.id}
                className="minimap-segment"
                style={{
                  left: `${(seg.startTime / duration) * 100}%`,
                  width: `${((seg.endTime - seg.startTime) / duration) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="minimap-sync-points">
        {timeline.syncPoints.map((sp) => (
          <div
            key={sp.id}
            className="minimap-sync-marker"
            style={{
              left: `${(sp.timestamp / duration) * 100}%`,
              backgroundColor: SYNC_POINT_COLORS[sp.type],
            }}
          />
        ))}
      </div>
    </div>
  )
}
