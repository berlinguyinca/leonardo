import { useCallback, useRef, useEffect } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import { playheadEmitter } from './PlayheadEmitter'

export function usePlayhead() {
  const playheadRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef(0)
  const rafRef = useRef<number>(0)

  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const setPlayheadPosition = useTimelineStore((s) => s.setPlayheadPosition)
  // NOTE: duration is NOT subscribed here — it's read imperatively inside the RAF
  // tick to avoid the closure-over-zero bug when the timeline loads after mount.

  const setVisualPosition = useCallback((timeMs: number) => {
    positionRef.current = timeMs
    playheadEmitter.emit('position', timeMs)
  }, [])

  const commitPosition = useCallback(() => {
    setPlayheadPosition(positionRef.current)
  }, [setPlayheadPosition])

  const seekTo = useCallback((timeMs: number) => {
    const currentDuration = useTimelineStore.getState().timeline?.duration ?? 0
    const clamped = Math.max(0, Math.min(timeMs, currentDuration))
    setVisualPosition(clamped)
    setPlayheadPosition(clamped)
  }, [setVisualPosition, setPlayheadPosition])

  useEffect(() => {
    if (!isPlaying) return

    // Sync positionRef with store (keyboard/external seeks may have changed it)
    positionRef.current = useTimelineStore.getState().playheadPosition

    // Reset to beginning if playhead is at or past the end of the timeline
    const currentDuration = useTimelineStore.getState().timeline?.duration ?? 0
    if (currentDuration > 0 && positionRef.current >= currentDuration) {
      positionRef.current = 0
      setVisualPosition(0)
      setPlayheadPosition(0)
    }

    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = now - lastTime
      lastTime = now
      const { playbackRate, timeline } = useTimelineStore.getState()
      const currentDuration = timeline?.duration ?? 0
      // If timeline not yet loaded, keep ticking without advancing
      if (currentDuration <= 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const newPos = positionRef.current + dt * playbackRate
      const clamped = Math.max(0, Math.min(newPos, currentDuration))
      if (clamped <= 0 || clamped >= currentDuration) {
        setVisualPosition(clamped)
        commitPosition()
        useTimelineStore.getState().setIsPlaying(false)
        useTimelineStore.getState().setPlaybackRate(1)
        return
      }
      setVisualPosition(newPos)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, setVisualPosition, commitPosition])
  // NOTE: `duration` intentionally NOT in deps — read imperatively inside tick

  return {
    playheadRef,
    positionRef,
    setVisualPosition,
    commitPosition,
    seekTo,
  }
}
