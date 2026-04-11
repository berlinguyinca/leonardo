import { useCallback, useRef, useState } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { usePlayhead } from '../../hooks/usePlayhead'
import { useTimelineZoom } from '../../hooks/useTimelineZoom'
import { timeToPixel } from './timeline-utils'
import { TimeRuler } from './TimeRuler'
import { Playhead } from './Playhead'
import { TrackLane } from './TrackLane'
import { ScrollContainer } from './ScrollContainer'
import { ZoomControls } from './ZoomControls'
import { TransportControls } from './TransportControls'

function EmptyTimelineDropZone(): React.ReactNode {
  const clips = useLibraryStore((s) => s.clips)
  const addClipToTimeline = useTimelineStore((s) => s.addClipToTimeline)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const clipId = e.dataTransfer.getData('application/clip-id')
    const clip = clips.find((c) => c.id === clipId)
    if (clip) addClipToTimeline(clip)
  }

  return (
    <div
      className={`timeline-container timeline-empty-dropzone${isDragOver ? ' drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="panel-placeholder">
        Drop clips here or double-click a clip to start
      </div>
    </div>
  )
}

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
    return <EmptyTimelineDropZone />
  }

  return (
    <div className="timeline-container" onClick={handleDeselect}>
      <div className="timeline-header">
        <TransportControls />
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
