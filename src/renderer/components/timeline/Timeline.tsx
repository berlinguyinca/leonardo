import { useCallback, useRef, useState } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { usePlayhead } from '../../hooks/usePlayhead'
import { useTimelineZoom } from '../../hooks/useTimelineZoom'
import { timeToPixel } from './timeline-utils'
import { TimeRuler } from './TimeRuler'
import { Playhead } from './Playhead'
import { TrackLane } from './TrackLane'
import { ScrollContainer } from './ScrollContainer'
import { ZoomControls } from './ZoomControls'

export function Timeline(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [visibleWidth] = useState(800)

  const { seekTo } = usePlayhead()
  const { zoom, handleWheel } = useTimelineZoom(scrollRef)

  const duration = timeline?.duration ?? 0
  const totalWidth = timeToPixel(duration, zoomLevel, 0) + 200

  const handleScroll = useCallback((scrollLeft: number) => {
    setScrollOffset(scrollLeft)
  }, [])

  const handleDeselect = useCallback(() => {
    useTimelineStore.getState().setSelectedSyncPoint(null)
    useTimelineStore.getState().setSelectedSegment(null)
  }, [])

  if (!timeline) {
    return (
      <div className="timeline-container">
        <div className="panel-placeholder">No timeline loaded</div>
      </div>
    )
  }

  return (
    <div className="timeline-container" onClick={handleDeselect}>
      <div className="timeline-header">
        <span className="timeline-title">Timeline</span>
        <ZoomControls
          onZoomIn={() => zoom('in')}
          onZoomOut={() => zoom('out')}
        />
      </div>
      <TimeRuler
        scrollOffset={scrollOffset}
        visibleWidth={visibleWidth}
        onSeek={seekTo}
      />
      <ScrollContainer
        ref={scrollRef}
        totalWidth={totalWidth}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <Playhead scrollOffset={scrollOffset} />
        {timeline.tracks.map((track) => (
          <TrackLane
            key={track.id}
            track={track}
            syncPoints={timeline.syncPoints.filter(
              (sp) => sp.type === 'freeze' || sp.type === 'zoom'
                ? track.type === 'recording'
                : track.type === 'audio',
            )}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
            onToggleMute={() => {}}
            onToggleLock={() => {}}
          />
        ))}
      </ScrollContainer>
    </div>
  )
}
