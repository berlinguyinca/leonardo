import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { useOverlayEditorStore } from '../../stores/overlay-editor-store'
import { playheadEmitter } from '../../hooks/PlayheadEmitter'
import { VideoPlayer } from '../preview/VideoPlayer'
import { TextOverlayElement } from './TextOverlayElement'
import { parseOverlayMetadata } from '@shared/types'
import type { Segment } from '@shared/types'

function filePathToMediaUrl(filePath: string): string {
  return `media:///${filePath}`
}

function findVideoSegmentAt(
  timeline: { tracks: { type: string; segments: Segment[] }[] } | null,
  position: number,
): Segment | undefined {
  if (!timeline) return undefined
  return timeline.tracks
    .filter((t) => t.type === 'clip' || t.type === 'recording')
    .flatMap((t) => t.segments)
    .find((s) => position >= s.startTime && position < s.endTime)
}

function findOverlaySegmentAt(
  timeline: { tracks: { type: string; segments: Segment[] }[] } | null,
  position: number,
): Segment | undefined {
  if (!timeline) return undefined
  return timeline.tracks
    .filter((t) => t.type === 'overlay')
    .flatMap((t) => t.segments)
    .find((s) => position >= s.startTime && position < s.endTime)
}

export function EffectsCanvas(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const storePosition = useTimelineStore((s) => s.playheadPosition)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const playbackRate = useTimelineStore((s) => s.playbackRate)
  const clips = useLibraryStore((s) => s.clips)
  const selectedElementId = useOverlayEditorStore((s) => s.selectedElementId)
  const setSelectedElement = useOverlayEditorStore((s) => s.setSelectedElement)

  const emitterPosRef = useRef(storePosition)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)

  useEffect(() => {
    if (!isPlaying) {
      emitterPosRef.current = storePosition
    }
  }, [isPlaying, storePosition])

  const timelineRef = useRef(timeline)
  timelineRef.current = timeline

  const handleEmitterPosition = useCallback((position: number) => {
    if (!useTimelineStore.getState().isPlaying) return
    emitterPosRef.current = position
    const seg = findVideoSegmentAt(timelineRef.current, position)
    const newId = seg?.id ?? null
    setActiveSegmentId((prev) => (prev !== newId ? newId : prev))
  }, [])

  useEffect(() => {
    playheadEmitter.on('position', handleEmitterPosition)
    return () => { playheadEmitter.off('position', handleEmitterPosition) }
  }, [handleEmitterPosition])

  const effectivePosition = isPlaying ? emitterPosRef.current : storePosition

  const activeVideoSegment: Segment | undefined = useMemo(() => {
    void activeSegmentId
    return findVideoSegmentAt(timeline, effectivePosition)
  }, [timeline, effectivePosition, activeSegmentId])

  const activeOverlaySegment: Segment | undefined = useMemo(() => {
    return findOverlaySegmentAt(timeline, effectivePosition)
  }, [timeline, effectivePosition])

  const activeClip = useMemo(() => {
    if (!activeVideoSegment) return undefined
    return clips.find((c) => c.filePath === activeVideoSegment.sourceFile)
  }, [activeVideoSegment, clips])

  const overlayMetadata = useMemo(() => {
    if (!activeOverlaySegment) return null
    return parseOverlayMetadata(activeOverlaySegment)
  }, [activeOverlaySegment])

  const videoTimeMs = activeVideoSegment
    ? effectivePosition - activeVideoSegment.startTime + activeVideoSegment.sourceOffset
    : 0

  return (
    <div
      className="effects-canvas"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}
      onClick={() => setSelectedElement(null)}
    >
      {activeClip ? (
        <VideoPlayer
          src={filePathToMediaUrl(activeClip.filePath)}
          currentTime={videoTimeMs}
          playing={isPlaying}
          playbackRate={playbackRate}
        />
      ) : (
        <div className="effects-canvas-empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
          No video at playhead position
        </div>
      )}

      {overlayMetadata && activeOverlaySegment && (
        <TextOverlayElement
          element={overlayMetadata.element}
          segmentId={activeOverlaySegment.id}
          isSelected={selectedElementId === overlayMetadata.element.id}
        />
      )}
    </div>
  )
}
