import { useCallback } from 'react'
import type { SyncPoint, SyncPointType } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { SYNC_POINT_COLORS } from '@shared/constants'

interface SyncPointPropertiesProps {
  syncPoint: SyncPoint
}

const SYNC_TYPES: SyncPointType[] = ['freeze', 'zoom', 'annotation', 'transition']

export function SyncPointProperties({ syncPoint }: SyncPointPropertiesProps): React.ReactNode {
  const updateSyncPoint = useTimelineStore((s) => s.updateSyncPoint)
  const removeSyncPoint = useTimelineStore((s) => s.removeSyncPoint)

  const handleUpdate = useCallback(
    (updates: Partial<SyncPoint>) => {
      updateSyncPoint(syncPoint.id, updates)
    },
    [syncPoint.id, updateSyncPoint],
  )

  return (
    <div className="properties-form">
      <div className="properties-section">
        <label className="properties-label">Type</label>
        <select
          className="properties-select"
          value={syncPoint.type}
          onChange={(e) => handleUpdate({ type: e.target.value as SyncPointType })}
        >
          {SYNC_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <div className="properties-color-chip" style={{ backgroundColor: SYNC_POINT_COLORS[syncPoint.type] }} />
      </div>
      <div className="properties-section">
        <label className="properties-label">Timestamp (ms)</label>
        <input className="properties-input" type="number" value={syncPoint.timestamp}
          onChange={(e) => handleUpdate({ timestamp: Math.max(0, Number(e.target.value)) })} min={0} step={100} />
      </div>
      <div className="properties-section">
        <label className="properties-label">Duration (ms)</label>
        <input className="properties-input" type="number" value={syncPoint.duration}
          onChange={(e) => handleUpdate({ duration: Math.max(0, Number(e.target.value)) })} min={0} step={100} />
      </div>
      {syncPoint.annotationText !== undefined && (
        <div className="properties-section">
          <label className="properties-label">Annotation</label>
          <textarea className="properties-textarea" value={syncPoint.annotationText}
            onChange={(e) => handleUpdate({ annotationText: e.target.value })} rows={3} />
        </div>
      )}
      <div className="properties-section">
        <label className="properties-label">Confidence</label>
        <span className="properties-value">{(syncPoint.confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">Source</label>
        <span className="properties-value">{syncPoint.source}</span>
      </div>
      <button className="properties-delete-btn" onClick={() => removeSyncPoint(syncPoint.id)}>Delete Sync Point</button>
    </div>
  )
}
