import { useTimelineStore } from '../../stores/timeline-store'
import { SyncPointProperties } from './SyncPointProperties'
import { SegmentProperties } from './SegmentProperties'

export function PropertiesPanel(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const selectedSyncPointId = useTimelineStore((s) => s.selectedSyncPointId)
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)

  if (!timeline) {
    return <p className="panel-placeholder">No timeline loaded</p>
  }

  if (selectedSyncPointId) {
    const syncPoint = timeline.syncPoints.find((sp) => sp.id === selectedSyncPointId)
    if (syncPoint) return <SyncPointProperties syncPoint={syncPoint} />
  }

  if (selectedSegmentId) {
    const segment = timeline.tracks.flatMap((t) => t.segments).find((s) => s.id === selectedSegmentId)
    if (segment) return <SegmentProperties segment={segment} />
  }

  return <p className="panel-placeholder">Select an item to edit</p>
}
