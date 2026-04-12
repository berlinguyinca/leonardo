import { useCallback, useRef, useState } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { usePlayhead } from '../../hooks/usePlayhead'
import { useTimelineZoom } from '../../hooks/useTimelineZoom'
import { playheadEmitter } from '../../hooks/PlayheadEmitter'
import { timeToPixel } from './timeline-utils'
import { TimeRuler } from './TimeRuler'
import { Playhead } from './Playhead'
import { TrackLane } from './TrackLane'
import { ScrollContainer } from './ScrollContainer'
import { ZoomControls } from './ZoomControls'
import { TransportControls } from './TransportControls'

const FRAME_MS = Math.round(1000 / 15) // 1 frame at 15fps capture rate

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

function jumpSegmentBoundary(dir: 'prev' | 'next'): void {
  const s = useTimelineStore.getState()
  const pos = s.playheadPosition
  const boundaries = Array.from(
    new Set(
      (s.timeline?.tracks ?? []).flatMap((t) =>
        t.segments.flatMap((seg) => [seg.startTime, seg.endTime]),
      ),
    ),
  ).sort((a, b) => a - b)

  const target =
    dir === 'next'
      ? boundaries.find((b) => b > pos)
      : [...boundaries].reverse().find((b) => b < pos)

  if (target !== undefined) {
    s.setPlayheadPosition(target)
    playheadEmitter.emit('position', target)
  }
}

export function Timeline(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const containerRef = useRef<HTMLDivElement>(null)
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

  const handleDeselect = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.timeline-segment')) return
    useTimelineStore.getState().setSelectedSyncPoint(null)
    useTimelineStore.getState().setSelectedSegment(null)
  }, [])

  // Focus the timeline container on click so keyboard events are scoped here
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    handleDeselect(e)
    containerRef.current?.focus()
  }, [handleDeselect])

  // Timeline-scoped keyboard shortcuts — only fire when this container has focus
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    // Arrow Left/Right — step 1 frame
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const s = useTimelineStore.getState()
      s.setIsPlaying(false)
      const newPos = Math.min(s.timeline?.duration ?? 0, s.playheadPosition + FRAME_MS)
      s.setPlayheadPosition(newPos)
      playheadEmitter.emit('position', newPos)
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const s = useTimelineStore.getState()
      s.setIsPlaying(false)
      const newPos = Math.max(0, s.playheadPosition - FRAME_MS)
      s.setPlayheadPosition(newPos)
      playheadEmitter.emit('position', newPos)
      return
    }

    // Arrow Up/Down — jump to previous/next clip boundary
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      jumpSegmentBoundary('next')
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      jumpSegmentBoundary('prev')
      return
    }

    // J/K/L — variable-speed transport (DaVinci Resolve style)
    if (e.key === 'l') {
      const s = useTimelineStore.getState()
      const next = s.isPlaying && s.playbackRate > 0 ? Math.min(s.playbackRate * 2, 8) : 1
      s.setPlaybackRate(next)
      s.setIsPlaying(true)
      return
    }
    if (e.key === 'k') {
      const s = useTimelineStore.getState()
      s.setIsPlaying(false)
      s.setPlaybackRate(1)
      return
    }
    if (e.key === 'j') {
      const s = useTimelineStore.getState()
      const next = s.isPlaying && s.playbackRate < 0 ? Math.max(s.playbackRate * 2, -8) : -1
      s.setPlaybackRate(next)
      s.setIsPlaying(true)
      return
    }

    // Home/End — jump to start/end
    if (e.key === 'Home') {
      useTimelineStore.getState().setPlayheadPosition(0)
      playheadEmitter.emit('position', 0)
      return
    }
    if (e.key === 'End') {
      const dur = useTimelineStore.getState().timeline?.duration ?? 0
      useTimelineStore.getState().setPlayheadPosition(dur)
      playheadEmitter.emit('position', dur)
      return
    }

    // +/- — zoom
    if (e.key === '+' || e.key === '=') {
      useTimelineStore.getState().setZoomLevel(
        Math.min(10, useTimelineStore.getState().zoomLevel * 1.2),
      )
      return
    }
    if (e.key === '-') {
      useTimelineStore.getState().setZoomLevel(
        Math.max(0.1, useTimelineStore.getState().zoomLevel / 1.2),
      )
      return
    }

    // Delete/Backspace — remove selected segment
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const { selectedSegmentId, removeSegment, setSelectedSegment } = useTimelineStore.getState()
      if (!selectedSegmentId) return
      e.preventDefault()
      removeSegment(selectedSegmentId)
      setSelectedSegment(null)
      return
    }
  }, [])

  if (!timeline) {
    return <EmptyTimelineDropZone />
  }

  return (
    <div
      ref={containerRef}
      className="timeline-container"
      tabIndex={0}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
    >
      <div className="timeline-header">
        <TransportControls seekTo={seekTo} />
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
            onSeek={seekTo}
          />
        ))}
      </ScrollContainer>
    </div>
  )
}
