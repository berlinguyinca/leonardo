import { useEffect, useRef } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useUIStore } from '../../stores/ui-store'
import { playheadEmitter } from '../../hooks/PlayheadEmitter'
import { SyncPointProperties } from './SyncPointProperties'
import { SegmentProperties } from './SegmentProperties'
import { OverlayProperties } from '../effects/OverlayProperties'
import type { SyncTimeline } from '@shared/types'

function findVideoSegmentAt(timeline: SyncTimeline, position: number): string | null {
  const seg = timeline.tracks
    .filter((t) => t.type === 'clip' || t.type === 'recording')
    .flatMap((t) => t.segments)
    .find((s) => position >= s.startTime && position < s.endTime)
  return seg ? seg.id : null
}

export function PropertiesPanel(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const selectedSyncPointId = useTimelineStore((s) => s.selectedSyncPointId)
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)
  const setSelectedSegment = useTimelineStore((s) => s.setSelectedSegment)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const followPlayhead = useUIStore((s) => s.followPlayhead)
  const setFollowPlayhead = useUIStore((s) => s.setFollowPlayhead)

  const prevSegmentIdRef = useRef<string | null>(null)
  const timelineRef = useRef(timeline)
  timelineRef.current = timeline

  useEffect(() => {
    if (!followPlayhead || !isPlaying || !timeline) return

    function onPosition(position: number) {
      const tl = timelineRef.current
      if (!tl) return
      const segId = findVideoSegmentAt(tl, position)
      if (segId !== prevSegmentIdRef.current) {
        prevSegmentIdRef.current = segId
        setSelectedSegment(segId)
      }
    }

    playheadEmitter.on('position', onPosition)
    return () => {
      playheadEmitter.off('position', onPosition)
    }
  }, [followPlayhead, isPlaying, setSelectedSegment])

  if (!timeline) {
    return <p className="panel-placeholder">No timeline loaded</p>
  }

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <button
          className={`follow-playhead-btn${followPlayhead ? ' active' : ''}`}
          onClick={() => setFollowPlayhead(!followPlayhead)}
          title="Auto-select segment under playhead during playback"
        >
          Follow
        </button>
      </div>

      {selectedSyncPointId && (() => {
        const syncPoint = timeline.syncPoints.find((sp) => sp.id === selectedSyncPointId)
        if (syncPoint) return <SyncPointProperties syncPoint={syncPoint} />
        return null
      })()}

      {!selectedSyncPointId && selectedSegmentId && (() => {
        const track = timeline.tracks.find((t) => t.segments.some((s) => s.id === selectedSegmentId))
        const segment = track?.segments.find((s) => s.id === selectedSegmentId)
        if (!segment) return null
        if (track?.type === 'overlay') return <OverlayProperties segment={segment} />
        return <SegmentProperties segment={segment} />
      })()}

      {!selectedSyncPointId && !selectedSegmentId && (
        <p className="panel-placeholder">Select an item to edit</p>
      )}
    </div>
  )
}
