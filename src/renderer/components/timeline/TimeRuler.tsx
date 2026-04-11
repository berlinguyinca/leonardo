import { useMemo } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { timeToPixel, pixelToTime, getGridInterval } from './timeline-utils'

interface TimeRulerProps {
  scrollOffset: number
  visibleWidth: number
  onSeek: (timeMs: number) => void
}

export function TimeRuler({ scrollOffset, visibleWidth, onSeek }: TimeRulerProps): React.ReactNode {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const duration = useTimelineStore((s) => s.timeline?.duration ?? 0)

  const ticks = useMemo(() => {
    const interval = getGridInterval(zoomLevel)
    const result: { timeMs: number; px: number; major: boolean }[] = []
    const pxPerSec = 100 * zoomLevel
    const startTime = Math.max(0, Math.floor((scrollOffset / pxPerSec) * 1000 / interval) * interval)

    for (let t = startTime; t <= duration; t += interval) {
      const px = timeToPixel(t, zoomLevel, scrollOffset)
      if (px < -50) continue
      if (px > visibleWidth + 50) break
      result.push({ timeMs: t, px, major: t % (interval * 5) === 0 })
    }
    return result
  }, [zoomLevel, duration, scrollOffset, visibleWidth])

  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const fraction = Math.round((ms % 1000) / 100)
    if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}.${fraction}`
    return `${seconds}.${fraction}s`
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(Math.max(0, pixelToTime(e.clientX - rect.left, zoomLevel, scrollOffset)))

    const onMove = (ev: MouseEvent) => {
      onSeek(Math.max(0, pixelToTime(ev.clientX - rect.left, zoomLevel, scrollOffset)))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="time-ruler" onMouseDown={handleMouseDown}>
      {ticks.map((tick) => (
        <div
          key={tick.timeMs}
          className={`time-ruler-tick ${tick.major ? 'major' : 'minor'}`}
          style={{ left: tick.px }}
        >
          {tick.major && <span className="time-ruler-label">{formatTime(tick.timeMs)}</span>}
        </div>
      ))}
    </div>
  )
}
