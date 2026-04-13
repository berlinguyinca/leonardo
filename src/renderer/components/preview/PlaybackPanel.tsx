import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { useScriptStore } from '../../stores/script-store'
import { playheadEmitter } from '../../hooks/PlayheadEmitter'
import { VideoPlayer } from './VideoPlayer'
import type { Segment } from '@shared/types'

function filePathToMediaUrl(filePath: string): string {
  return `media://${filePath}`
}

function findSegmentAt(timeline: { tracks: { type: string; segments: Segment[] }[] } | null, position: number): Segment | undefined {
  if (!timeline) return undefined
  return timeline.tracks
    .filter((t) => t.type === 'clip' || t.type === 'recording')
    .flatMap((t) => t.segments)
    .find((s) => position >= s.startTime && position < s.endTime)
}

export function PlaybackPanel(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const storePosition = useTimelineStore((s) => s.playheadPosition)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const playbackRate = useTimelineStore((s) => s.playbackRate)
  const clips = useLibraryStore((s) => s.clips)
  const voiceovers = useScriptStore((s) => s.voiceovers)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Real-time position tracking via emitter (only used during playback)
  const emitterPosRef = useRef(storePosition)
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null)

  // Keep emitter ref in sync with store when paused
  useEffect(() => {
    if (!isPlaying) {
      emitterPosRef.current = storePosition
    }
  }, [isPlaying, storePosition])

  // Subscribe to emitter for real-time segment boundary detection
  const timelineRef = useRef(timeline)
  timelineRef.current = timeline

  const handleEmitterPosition = useCallback((position: number) => {
    if (!useTimelineStore.getState().isPlaying) return
    emitterPosRef.current = position
    const seg = findSegmentAt(timelineRef.current, position)
    const newId = seg?.id ?? null
    setActiveSegmentId((prev) => (prev !== newId ? newId : prev))
  }, [])

  useEffect(() => {
    playheadEmitter.on('position', handleEmitterPosition)
    return () => { playheadEmitter.off('position', handleEmitterPosition) }
  }, [handleEmitterPosition])

  // Compute effective position: emitter during playback, store when paused
  const effectivePosition = isPlaying ? emitterPosRef.current : storePosition

  // Find which segment the playhead is currently over
  const activeSegment: Segment | undefined = useMemo(() => {
    // activeSegmentId in deps ensures re-computation on boundary crossings during playback
    void activeSegmentId
    return findSegmentAt(timeline, effectivePosition)
  }, [timeline, effectivePosition, activeSegmentId])

  // Find the clip matching this segment's source file
  const activeClip = useMemo(() => {
    if (!activeSegment) return undefined
    return clips.find((c) => c.filePath === activeSegment.sourceFile)
  }, [activeSegment, clips])

  // Resolve active segment's voiceover (if any)
  const activeSectionId = useMemo(() => {
    if (!activeSegment?.metadata) return null
    try {
      const meta = JSON.parse(activeSegment.metadata) as { sectionId?: string }
      return meta.sectionId ?? null
    } catch { return null }
  }, [activeSegment])

  const activeVoiceover = activeSectionId ? voiceovers[activeSectionId] : null
  const voiceoverSrc =
    activeVoiceover && !activeVoiceover.stale && activeVoiceover.filePath
      ? `media://${activeVoiceover.filePath}`
      : null

  // Calculate video time from playhead position relative to segment
  // (computed here so we can use it in the effect below)
  // Clamp to sourceDuration so video freezes on last frame when segment is extended for voiceover
  const rawVideoTimeMs = activeSegment
    ? effectivePosition - activeSegment.startTime + activeSegment.sourceOffset
    : 0
  const videoTimeMs = activeSegment?.sourceDuration != null
    ? Math.min(rawVideoTimeMs, activeSegment.sourceOffset + activeSegment.sourceDuration - 1)
    : rawVideoTimeMs

  // Sync audio with video playback — section-driven, not per-frame
  const lastAudioSectionRef = useRef<string | null>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!voiceoverSrc) {
      audio.pause()
      lastAudioSectionRef.current = null
      return
    }

    if (isPlaying) {
      if (activeSectionId !== lastAudioSectionRef.current) {
        // New section — start voiceover from beginning
        lastAudioSectionRef.current = activeSectionId
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else if (audio.paused) {
        // Resuming in same section — continue from where we left off
        audio.play().catch(() => {})
      }
    } else {
      audio.pause()
    }
  }, [isPlaying, activeSectionId, voiceoverSrc])

  if (!activeSegment || !activeClip) {
    return (
      <div className="playback-panel">
        <p className="panel-placeholder">No video to preview</p>
      </div>
    )
  }

  return (
    <div className="playback-panel">
      <VideoPlayer
        src={filePathToMediaUrl(activeClip.filePath)}
        currentTime={videoTimeMs}
        playing={isPlaying}
        playbackRate={playbackRate}
      />
      <audio
        key={voiceoverSrc ?? 'no-voiceover'}
        ref={audioRef}
        src={voiceoverSrc ?? undefined}
        preload="auto"
      />
    </div>
  )
}
