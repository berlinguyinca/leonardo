import { useEffect, useRef, useState } from 'react'
import type { Segment } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { useLibraryStore } from '../../stores/library-store'
import { useScriptStore } from '../../stores/script-store'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'

interface SegmentContextMenuProps {
  segment: Segment
  position: { x: number; y: number }
  onClose: () => void
}

export function SegmentContextMenu({ segment, position, onClose }: SegmentContextMenuProps): React.ReactNode {
  const menuRef = useRef<HTMLUListElement>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [scriptPrompt, setScriptPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const removeSegment = useTimelineStore((s) => s.removeSegment)
  const setSelectedSegment = useTimelineStore((s) => s.setSelectedSegment)
  const clips = useLibraryStore((s) => s.clips)
  const setSections = useScriptStore((s) => s.setSections)
  const setClipScript = useScriptStore((s) => s.setClipScript)
  const setEditorView = useUIStore((s) => s.setEditorView)
  const setTimelineCollapsed = useUIStore((s) => s.setTimelineCollapsed)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  const clip = clips.find((c) => c.filePath === segment.sourceFile)

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
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function handleGenerate() {
    if (!scriptPrompt.trim() || !clip || !window.leonardo?.ai) return
    if (!activeProjectId) {
      setGenError('No active project selected')
      return
    }
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
        projectId: activeProjectId,
        clipId: clip.id,
      })
      if (result.success && result.script) {
        setClipScript(clip.id, result.script.sections)
        setSections(result.script.sections)
        setEditorView('script-only')
        setTimelineCollapsed(false)
        onClose()
      } else {
        setGenError(result.error ?? 'Generation failed')
      }
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Unexpected error')
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
        onClick={(e) => {
          e.stopPropagation()
          removeSegment(segment.id)
          setSelectedSegment(null)
          onClose()
        }}
      >
        Remove from Timeline
      </li>
      <li
        onClick={() => {
          if (!showPrompt) setShowPrompt(true)
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
              disabled={generating || !scriptPrompt.trim() || !clip}
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        ) : (
          'Generate Script'
        )}
      </li>
    </ul>
  )
}
