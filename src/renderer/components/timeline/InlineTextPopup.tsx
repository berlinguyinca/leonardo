import { useState, useCallback } from 'react'

interface InlineTextPopupProps {
  text: string
  voiceProfileId: string | null
  position: { x: number; y: number }
  onSave: (text: string, voiceProfileId: string | null) => void
  onClose: () => void
}

export function InlineTextPopup({
  text: initialText,
  voiceProfileId: initialVoice,
  position,
  onSave,
  onClose,
}: InlineTextPopupProps): React.ReactNode {
  const [text, setText] = useState(initialText)
  const [voice, setVoice] = useState(initialVoice)

  const handleSave = useCallback(() => {
    onSave(text, voice)
    onClose()
  }, [text, voice, onSave, onClose])

  return (
    <div
      className="inline-text-popup"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        className="inline-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        autoFocus
      />
      <div className="inline-text-controls">
        <select
          className="section-voice-select"
          value={voice ?? ''}
          onChange={(e) => setVoice(e.target.value || null)}
        >
          <option value="">Default Voice</option>
        </select>
        <div className="inline-text-buttons">
          <button className="toolbar-btn" onClick={onClose}>Cancel</button>
          <button className="wizard-btn wizard-btn-create" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
