import { useTimelineStore } from '../../stores/timeline-store'

interface ZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
}

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps): React.ReactNode {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)

  return (
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={onZoomOut} aria-label="Zoom out">-</button>
      <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
      <button className="zoom-btn" onClick={onZoomIn} aria-label="Zoom in">+</button>
    </div>
  )
}
