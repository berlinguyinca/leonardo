import { useTimelineStore } from '../../stores/timeline-store'
import { usePlayhead } from '../../hooks/usePlayhead'

const STEP_MS = 5_000

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const fraction = Math.round((ms % 1000) / 100)
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}.${fraction}`
  return `${seconds}.${fraction}s`
}

export function TransportControls(): React.ReactNode {
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const position = useTimelineStore((s) => s.playheadPosition)
  const duration = useTimelineStore((s) => s.timeline?.duration ?? 0)
  const { seekTo } = usePlayhead()

  return (
    <div className="transport-controls">
      <button
        className="transport-btn"
        title="Go to start"
        onClick={() => seekTo(0)}
      >
        ⏮
      </button>
      <button
        className="transport-btn"
        title="Step back 5s"
        onClick={() => seekTo(Math.max(0, position - STEP_MS))}
      >
        ⏪
      </button>
      <button
        className="transport-btn transport-btn-play"
        title={isPlaying ? 'Pause' : 'Play'}
        onClick={() => useTimelineStore.getState().setIsPlaying(!isPlaying)}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        className="transport-btn"
        title="Step forward 5s"
        onClick={() => seekTo(Math.min(duration, position + STEP_MS))}
      >
        ⏩
      </button>
      <button
        className="transport-btn"
        title="Go to end"
        onClick={() => seekTo(duration)}
      >
        ⏭
      </button>
      <span className="transport-time">
        {formatTime(position)} / {formatTime(duration)}
      </span>
    </div>
  )
}
