import { useCallback, useRef, useEffect } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import { playheadEmitter } from './PlayheadEmitter'

export function usePlayhead() {
  const playheadRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef(0)
  const rafRef = useRef<number>(0)

  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const setPlayheadPosition = useTimelineStore((s) => s.setPlayheadPosition)
  const duration = useTimelineStore((s) => s.timeline?.duration ?? 0)

  const setVisualPosition = useCallback((timeMs: number) => {
    positionRef.current = timeMs
    playheadEmitter.emit('position', timeMs)
  }, [])

  const commitPosition = useCallback(() => {
    setPlayheadPosition(positionRef.current)
  }, [setPlayheadPosition])

  const seekTo = useCallback((timeMs: number) => {
    const clamped = Math.max(0, Math.min(timeMs, duration))
    setVisualPosition(clamped)
    setPlayheadPosition(clamped)
  }, [duration, setVisualPosition, setPlayheadPosition])

  useEffect(() => {
    if (!isPlaying) return

    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = now - lastTime
      lastTime = now
      const rate = useTimelineStore.getState().playbackRate
      const newPos = positionRef.current + dt * rate
      const clamped = Math.max(0, Math.min(newPos, duration))
      if (clamped <= 0 || clamped >= duration) {
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
  }, [isPlaying, duration, setVisualPosition, commitPosition])

  return {
    playheadRef,
    positionRef,
    setVisualPosition,
    commitPosition,
    seekTo,
  }
}
