import { useState } from 'react'
import type { Segment } from '@shared/types'
import { useLibraryStore } from '../../stores/library-store'
import { useScriptStore } from '../../stores/script-store'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'
import { InteractionsPanel } from './InteractionsPanel'

interface SegmentPropertiesProps {
  segment: Segment
}

export function SegmentProperties({ segment }: SegmentPropertiesProps): React.ReactNode {
  const clips = useLibraryStore((s) => s.clips)
  const clip = clips.find((c) => c.filePath === segment.sourceFile)

  const [showPrompt, setShowPrompt] = useState(false)
  const [scriptPrompt, setScriptPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const setSections = useScriptStore((s) => s.setSections)
  const setClipScript = useScriptStore((s) => s.setClipScript)
  const setEditorView = useUIStore((s) => s.setEditorView)
  const setTimelineCollapsed = useUIStore((s) => s.setTimelineCollapsed)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)

  async function handleGenerate() {
    if (!scriptPrompt.trim() || !clip || !window.leonardo?.ai) return
    if (!activeProjectId) { setGenError('No active project'); return }
    setGenerating(true)
    setGenError(null)
    try {
      const result = await window.leonardo.ai.generateScript({
        config: { provider: 'claude', mode: 'cloud' },
        prompt: scriptPrompt,
        context: { domEvents: [], recordingDuration: clip.duration, url: clip.url, userPrompt: scriptPrompt },
        projectId: activeProjectId,
        clipId: clip.id,
      })
      if (result.success && result.script) {
        setClipScript(clip.id, result.script.sections)
        setSections(result.script.sections)
        setEditorView('script-only')
        setTimelineCollapsed(false)
        setShowPrompt(false)
        setScriptPrompt('')
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
    <div className="properties-form">
      <div className="properties-section">
        <label className="properties-label">Label</label>
        <span className="properties-value">{segment.label}</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">Start Time (ms)</label>
        <span className="properties-value">{segment.startTime}</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">End Time (ms)</label>
        <span className="properties-value">{segment.endTime}</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">Duration</label>
        <span className="properties-value">{segment.endTime - segment.startTime}ms</span>
      </div>
      <div className="properties-section">
        <label className="properties-label">Source</label>
        <span className="properties-value">{segment.sourceFile || 'N/A'}</span>
      </div>
      {clip && (
        <InteractionsPanel clipId={clip.id} segmentStartTime={segment.startTime} />
      )}
      {clip && (
        <div className="properties-section">
          {!showPrompt ? (
            <button
              className="clip-context-menu-generate-btn"
              onClick={() => setShowPrompt(true)}
            >
              Generate Script
            </button>
          ) : (
            <div>
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
              <button onClick={() => { setShowPrompt(false); setScriptPrompt(''); setGenError(null) }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
