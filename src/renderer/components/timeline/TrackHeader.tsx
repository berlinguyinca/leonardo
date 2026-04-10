import type { Track } from '@shared/types'

interface TrackHeaderProps {
  track: Track
  onToggleMute: () => void
  onToggleLock: () => void
}

export function TrackHeader({ track, onToggleMute, onToggleLock }: TrackHeaderProps): React.ReactNode {
  return (
    <div className="track-header">
      <span className="track-label">{track.label}</span>
      <div className="track-header-controls">
        <button
          className={`track-header-btn ${track.muted ? 'active' : ''}`}
          onClick={onToggleMute}
          aria-label={track.muted ? 'Unmute' : 'Mute'}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          M
        </button>
        <button
          className={`track-header-btn ${track.locked ? 'active' : ''}`}
          onClick={onToggleLock}
          aria-label={track.locked ? 'Unlock' : 'Lock'}
          title={track.locked ? 'Unlock' : 'Lock'}
        >
          L
        </button>
      </div>
    </div>
  )
}
