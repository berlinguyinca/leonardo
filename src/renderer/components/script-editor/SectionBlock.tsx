import type { ScriptSection } from '@shared/types'
import { TimingMarkerChip } from './TimingMarkerChip'

interface SectionBlockProps {
  section: ScriptSection
  isActive: boolean
  onTextChange: (text: string) => void
  onVoiceChange: (voiceId: string | null) => void
  onClick: () => void
}

export function SectionBlock({
  section,
  isActive,
  onTextChange,
  onVoiceChange,
  onClick,
}: SectionBlockProps): React.ReactNode {
  return (
    <div
      className={`section-block ${isActive ? 'active' : ''}`}
      onClick={onClick}
      data-section-id={section.id}
    >
      <div className="section-block-header">
        <span className="section-block-number">Section {section.order + 1}</span>
        <select
          className="section-voice-select"
          value={section.voiceProfileId ?? ''}
          onChange={(e) => onVoiceChange(e.target.value || null)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Default Voice</option>
        </select>
      </div>

      {section.timingMarkers.length > 0 && (
        <div className="section-markers">
          {section.timingMarkers.map((marker, i) => (
            <TimingMarkerChip key={i} marker={marker} />
          ))}
        </div>
      )}

      <textarea
        className="section-block-text"
        value={section.text}
        onChange={(e) => onTextChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        rows={Math.max(2, Math.ceil(section.text.length / 80))}
      />

      <div className="section-block-footer">
        <span className="section-timing">
          {formatTime(section.startTime)} — {formatTime(section.endTime)}
        </span>
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}
