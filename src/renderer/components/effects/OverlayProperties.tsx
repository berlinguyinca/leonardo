import { useTimelineStore } from '../../stores/timeline-store'
import { parseOverlayMetadata } from '@shared/types'
import type { Segment, TransitionAnimation } from '@shared/types'

const FONT_FAMILIES = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS']

const TRANSITIONS: { value: TransitionAnimation; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'typewriter', label: 'Typewriter' },
]

interface OverlayPropertiesProps {
  segment: Segment
}

export function OverlayProperties({ segment }: OverlayPropertiesProps): React.ReactNode {
  const updateSegmentMetadata = useTimelineStore((s) => s.updateSegmentMetadata)

  const meta = parseOverlayMetadata(segment)
  if (!meta) {
    return <p className="panel-placeholder">No overlay data found</p>
  }

  const el = meta.element

  function update(patch: Partial<typeof el>) {
    const updated = JSON.stringify({ element: { ...el, ...patch } })
    updateSegmentMetadata(segment.id, updated)
  }

  return (
    <div className="properties-form">
      <div className="properties-section">
        <label className="properties-label">Text</label>
        <textarea
          className="properties-textarea"
          value={el.text}
          rows={3}
          onChange={(e) => update({ text: e.target.value })}
        />
      </div>

      <div className="properties-section">
        <label className="properties-label">Position X (%)</label>
        <input
          type="number"
          className="properties-input"
          value={Math.round(el.x)}
          min={0}
          max={100}
          onChange={(e) => update({ x: Number(e.target.value) })}
        />
      </div>
      <div className="properties-section">
        <label className="properties-label">Position Y (%)</label>
        <input
          type="number"
          className="properties-input"
          value={Math.round(el.y)}
          min={0}
          max={100}
          onChange={(e) => update({ y: Number(e.target.value) })}
        />
      </div>

      <div className="properties-section">
        <label className="properties-label">Width (%)</label>
        <input
          type="number"
          className="properties-input"
          value={Math.round(el.width)}
          min={1}
          max={100}
          onChange={(e) => update({ width: Number(e.target.value) })}
        />
      </div>
      <div className="properties-section">
        <label className="properties-label">Height (%)</label>
        <input
          type="number"
          className="properties-input"
          value={Math.round(el.height)}
          min={1}
          max={100}
          onChange={(e) => update({ height: Number(e.target.value) })}
        />
      </div>

      <div className="properties-section">
        <label className="properties-label">Font Family</label>
        <select
          className="properties-select"
          value={el.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="properties-section">
        <label className="properties-label">Font Size (px)</label>
        <input
          type="number"
          className="properties-input"
          value={el.fontSize}
          min={8}
          max={200}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
        />
      </div>
      <div className="properties-section">
        <label className="properties-label">Color</label>
        <input
          type="color"
          className="properties-color"
          value={el.color}
          onChange={(e) => update({ color: e.target.value })}
        />
      </div>

      <div className="properties-section">
        <label className="properties-label">Background Color</label>
        <input
          type="color"
          className="properties-color"
          value={el.backgroundColor}
          onChange={(e) => update({ backgroundColor: e.target.value })}
        />
      </div>
      <div className="properties-section">
        <label className="properties-label">Background Opacity</label>
        <input
          type="range"
          className="properties-range"
          value={el.backgroundOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={(e) => update({ backgroundOpacity: Number(e.target.value) })}
        />
        <span className="properties-value">{Math.round(el.backgroundOpacity * 100)}%</span>
      </div>

      <div className="properties-section">
        <label className="properties-label">Transition In</label>
        <select
          className="properties-select"
          value={el.transitionIn}
          onChange={(e) => update({ transitionIn: e.target.value as TransitionAnimation })}
        >
          {TRANSITIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="properties-section">
        <label className="properties-label">Transition Out</label>
        <select
          className="properties-select"
          value={el.transitionOut}
          onChange={(e) => update({ transitionOut: e.target.value as TransitionAnimation })}
        >
          {TRANSITIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="properties-section">
        <label className="properties-label">Transition Duration (ms)</label>
        <input
          type="number"
          className="properties-input"
          value={el.transitionDuration}
          min={0}
          max={5000}
          step={100}
          onChange={(e) => update({ transitionDuration: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
