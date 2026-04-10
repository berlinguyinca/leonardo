import { useEffect, useRef } from 'react'
import { playheadEmitter } from '../../hooks/PlayheadEmitter'
import { useTimelineStore } from '../../stores/timeline-store'
import { timeToPixel } from './timeline-utils'

interface PlayheadProps {
  scrollOffset: number
}

export function Playhead({ scrollOffset }: PlayheadProps): React.ReactNode {
  const lineRef = useRef<HTMLDivElement>(null)
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const storedPosition = useTimelineStore((s) => s.playheadPosition)

  useEffect(() => {
    const px = timeToPixel(storedPosition, zoomLevel, scrollOffset)
    if (lineRef.current) {
      lineRef.current.style.transform = `translateX(${px}px)`
    }
  }, [storedPosition, zoomLevel, scrollOffset])

  useEffect(() => {
    const handler = (timeMs: number) => {
      if (!lineRef.current) return
      const px = timeToPixel(timeMs, zoomLevel, scrollOffset)
      lineRef.current.style.transform = `translateX(${px}px)`
    }
    playheadEmitter.on('position', handler)
    return () => { playheadEmitter.off('position', handler) }
  }, [zoomLevel, scrollOffset])

  return (
    <div className="playhead" ref={lineRef}>
      <div className="playhead-head" />
      <div className="playhead-line" />
    </div>
  )
}
