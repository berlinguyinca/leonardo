import { useEffect, useRef, useState } from 'react'
import type { Clip } from '@shared/types/events'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { useScriptStore } from '../../stores/script-store'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'

interface ClipContextMenuProps {
  clip: Clip
  position: { x: number; y: number }
  onClose: () => void
}

export function ClipContextMenu({ clip, position, onClose }: ClipContextMenuProps): React.ReactNode {
  const menuRef = useRef<HTMLUListElement>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [scriptPrompt, setScriptPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const addClipToTimeline = useTimelineStore((s) => s.addClipToTimeline)
  const removeClip = useLibraryStore((s) => s.removeClip)
  const setSections = useScriptStore((s) => s.setSections)
  const setEditorView = useUIStore((s) => s.setEditorView)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleGenerate() {
    if (!scriptPrompt.trim() || !window.leonardo?.ai) return
    setGenerating(true)
    setGenError(null)
    try {
      const result = await window.leonardo.ai.generateScript({
        config: { provider: 'claude', mode: 'cloud' },
        prompt: scriptPrompt,
        context: {
          domEvents: [],
          recordingDuration: clip.duration,
          url: clip.url,
          userPrompt: scriptPrompt,
        },
        projectId: activeProjectId ?? '',
      })
      if (result.success && result.script) {
        setSections(result.script.sections)
        setEditorView('script-only')
        onClose()
      } else {
        setGenError(result.error ?? 'Generation failed')
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <ul
      ref={menuRef}
      className="clip-context-menu"
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 1000 }}
    >
      <li
        onClick={() => {
          addClipToTimeline(clip)
          onClose()
        }}
      >
        Add to Timeline
      </li>
      <li
        onClick={() => {
          removeClip(clip.id)
          onClose()
        }}
      >
        Delete
      </li>
      <li
        onClick={() => {
          if (!showPrompt) {
            setShowPrompt(true)
          }
        }}
      >
        {showPrompt ? (
          <div className="clip-context-menu-prompt" onClick={(e) => e.stopPropagation()}>
            <textarea
              className="clip-context-menu-textarea"
              value={scriptPrompt}
              onChange={(e) => setScriptPrompt(e.target.value)}
              placeholder="Describe what to generate..."
              rows={3}
              autoFocus
            />
            {genError && <div className="clip-context-menu-error">{genError}</div>}
            <button
              className="clip-context-menu-generate-btn"
              onClick={handleGenerate}
              disabled={generating || !scriptPrompt.trim()}
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        ) : (
          'Generate Script'
        )}
      </li>
      <li
        onClick={() => {
          if (window.leonardo?.clip) {
            window.leonardo.clip.export(clip.id)
          }
          onClose()
        }}
      >
        Export
      </li>
    </ul>
  )
}
