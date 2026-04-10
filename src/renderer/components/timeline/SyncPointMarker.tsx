import { useCallback } from 'react'
import type { SyncPoint } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { usePointerDrag } from '../../hooks/usePointerDrag'
import { timeToPixel } from './timeline-utils'
import { SYNC_POINT_COLORS } from '@shared/constants'

interface SyncPointMarkerProps {
  syncPoint: SyncPoint
  zoomLevel: number
  scrollOffset: number
}

export function SyncPointMarker({ syncPoint, zoomLevel, scrollOffset }: SyncPointMarkerProps): React.ReactNode {
  const selectedSyncPointId = useTimelineStore((s) => s.selectedSyncPointId)
  const setSelectedSyncPoint = useTimelineStore((s) => s.setSelectedSyncPoint)
  const updateSyncPoint = useTimelineStore((s) => s.updateSyncPoint)
  const isSelected = selectedSyncPointId === syncPoint.id

  const left = timeToPixel(syncPoint.timestamp, zoomLevel, scrollOffset)
  const width = syncPoint.duration > 0
    ? timeToPixel(syncPoint.timestamp + syncPoint.duration, zoomLevel, scrollOffset) - left
    : 8
  const color = SYNC_POINT_COLORS[syncPoint.type] ?? '#888'

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedSyncPoint(syncPoint.id)
    },
    [syncPoint.id, setSelectedSyncPoint],
  )

  const { onPointerDown } = usePointerDrag({
    axis: 'x',
    threshold: 3,
    onDrag: () => {},
    onDragEnd: (dx) => {
      const pxPerMs = (100 * zoomLevel) / 1000
      const deltaMs = dx / pxPerMs
      updateSyncPoint(syncPoint.id, {
        timestamp: Math.max(0, syncPoint.timestamp + deltaMs),
      })
    },
  })

  const hasDuration = syncPoint.type === 'freeze' || syncPoint.type === 'zoom'

  return (
    <div
      className={`sync-point-marker ${isSelected ? 'selected' : ''}`}
      style={{ left, width: Math.max(width, 8), backgroundColor: color }}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      data-sync-point-id={syncPoint.id}
      title={`${syncPoint.type} (${syncPoint.source})`}
    >
      {hasDuration && <div className="sync-point-edge sync-point-edge-right" />}
    </div>
  )
}
