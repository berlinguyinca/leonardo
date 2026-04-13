import type { OverlayType } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'

interface OverlayButton {
  type: OverlayType
  label: string
  color: string
}

const OVERLAY_BUTTONS: OverlayButton[] = [
  { type: 'intro', label: 'Add Intro', color: '#3b82f6' },
  { type: 'exit', label: 'Add Exit', color: '#ef4444' },
  { type: 'title', label: 'Add Title', color: '#f59e0b' },
  { type: 'section', label: 'Add Section', color: '#8b5cf6' },
]

export function OverlayToolbar(): React.ReactNode {
  const playheadPosition = useTimelineStore((s) => s.playheadPosition)
  const addOverlaySegment = useTimelineStore((s) => s.addOverlaySegment)

  function handleAdd(type: OverlayType): void {
    addOverlaySegment(type, playheadPosition, 3000)
  }

  return (
    <div className="overlay-toolbar" data-testid="overlay-toolbar">
      {OVERLAY_BUTTONS.map(({ type, label, color }) => (
        <button
          key={type}
          className="overlay-toolbar-btn"
          style={{ borderColor: color, color }}
          onClick={() => handleAdd(type)}
          data-overlay-type={type}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
