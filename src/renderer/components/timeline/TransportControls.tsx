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

// Inline SVG icon components — 16×16 viewBox, currentColor fill
function IconGoToStart() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="2" width="2" height="12" />
      <polygon points="14,2 6,8 14,14" />
    </svg>
  )
}

function IconStepBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="9,2 2,8 9,14" />
      <polygon points="15,2 8,8 15,14" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="3,2 13,8 3,14" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" />
      <rect x="9" y="2" width="4" height="12" />
    </svg>
  )
}

function IconStepForward() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="1,2 8,8 1,14" />
      <polygon points="7,2 14,8 7,14" />
    </svg>
  )
}

function IconGoToEnd() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="2,2 10,8 2,14" />
      <rect x="12" y="2" width="2" height="12" />
    </svg>
  )
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
        <IconGoToStart />
      </button>
      <button
        className="transport-btn"
        title="Step back 5s"
        onClick={() => seekTo(Math.max(0, position - STEP_MS))}
      >
        <IconStepBack />
      </button>
      <button
        className="transport-btn transport-btn-play"
        title={isPlaying ? 'Pause' : 'Play'}
        onClick={() => useTimelineStore.getState().setIsPlaying(!isPlaying)}
      >
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>
      <button
        className="transport-btn"
        title="Step forward 5s"
        onClick={() => seekTo(Math.min(duration, position + STEP_MS))}
      >
        <IconStepForward />
      </button>
      <button
        className="transport-btn"
        title="Go to end"
        onClick={() => seekTo(duration)}
      >
        <IconGoToEnd />
      </button>
      <span className="transport-time">
        {formatTime(position)} / {formatTime(duration)}
      </span>
    </div>
  )
}
