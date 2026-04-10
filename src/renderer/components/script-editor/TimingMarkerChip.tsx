import type { TimingMarker } from '@shared/types'

interface TimingMarkerChipProps {
  marker: TimingMarker
}

const MARKER_COLORS: Record<string, string> = {
  pause: '#94a3b8',
  zoom: '#22c55e',
  freeze: '#3b82f6',
  transition: '#a855f7',
}

export function TimingMarkerChip({ marker }: TimingMarkerChipProps): React.ReactNode {
  const label = marker.type === 'pause'
    ? `PAUSE ${marker.duration ?? 0}s`
    : marker.type === 'zoom'
      ? `ZOOM ${marker.selector ?? ''}`
      : marker.type === 'freeze'
        ? `FREEZE ${marker.duration ?? 0}s`
        : `TRANSITION ${marker.transitionType ?? ''}`

  return (
    <span
      className="timing-marker-chip"
      style={{ borderColor: MARKER_COLORS[marker.type] }}
      title={label}
    >
      {label}
    </span>
  )
}
