import { useCallback, useRef, useState } from 'react'
import { useScriptStore } from '../../stores/script-store'
import { useComposeStore } from '../../stores/compose-store'
import type { AIProviderType } from '@shared/types/ai'

const AI_PROVIDERS: { value: AIProviderType; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'codex', label: 'Codex' },
  { value: 'ollama', label: 'Ollama' },
]

export function ScriptPresetView(): React.ReactNode {
  const sections = useScriptStore((s) => s.sections)
  const aiProvider = useComposeStore((s) => s.aiProvider)
  const setAIProvider = useComposeStore((s) => s.setAIProvider)
  const isGenerating = useComposeStore((s) => s.isGenerating)

  const [verticalSplit, setVerticalSplit] = useState(60) // percentage
  const [horizontalSplit, setHorizontalSplit] = useState(70) // percentage

  const isDraggingVertical = useRef(false)
  const isDraggingHorizontal = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleVerticalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingVertical.current = true

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingVertical.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setVerticalSplit(Math.max(20, Math.min(80, pct)))
    }

    const handleMouseUp = () => {
      isDraggingVertical.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleHorizontalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingHorizontal.current = true

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingHorizontal.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientY - rect.top) / rect.height) * 100
      setHorizontalSplit(Math.max(30, Math.min(85, pct)))
    }

    const handleMouseUp = () => {
      isDraggingHorizontal.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  return (
    <div
      ref={containerRef}
      className="script-preset-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-panel, #1a1a1a)',
      }}
    >
      {/* Top section: script editor + preview */}
      <div
        style={{
          display: 'flex',
          flex: `0 0 ${horizontalSplit}%`,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left pane: Script editor */}
        <div
          className="script-editor-pane"
          style={{
            flex: `0 0 ${verticalSplit}%`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-panel, #1a1a1a)',
            borderRight: '1px solid var(--border, #333)',
          }}
        >
          <div
            className="panel-header"
            style={{
              padding: '6px 12px',
              background: 'var(--bg-panel-header, #141414)',
              borderBottom: '1px solid var(--border, #333)',
              fontSize: 12,
              color: 'var(--text-secondary, #888)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Script Editor</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                className="ai-backend-selector"
                value={aiProvider}
                onChange={(e) => setAIProvider(e.target.value as AIProviderType)}
                style={{
                  background: 'var(--bg-hover, #252525)',
                  color: 'var(--text-primary, #d0d0d0)',
                  border: '1px solid var(--border, #333)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 11,
                }}
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                className="generate-btn"
                disabled={isGenerating}
                style={{
                  background: 'var(--accent, #4a9eff)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 10px',
                  fontSize: 11,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.6 : 1,
                }}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          <div
            className="script-sections-list"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 12,
            }}
          >
            {sections.length === 0 && (
              <div
                style={{
                  color: 'var(--text-muted, #555)',
                  textAlign: 'center',
                  marginTop: 40,
                  fontSize: 12,
                }}
              >
                No script sections. Generate a script to get started.
              </div>
            )}
            {sections.map((section) => (
              <div
                key={section.id}
                className="section-block"
                style={{
                  marginBottom: 12,
                  background: 'var(--bg-hover, #252525)',
                  borderRadius: 6,
                  border: '1px solid var(--border, #333)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className="section-header"
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-panel-header, #141414)',
                    borderBottom: '1px solid var(--border, #333)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary, #888)',
                  }}
                >
                  Step {section.order + 1}
                </div>
                <div
                  className="section-content"
                  style={{
                    padding: '8px 10px',
                    fontSize: 12,
                    color: 'var(--text-primary, #d0d0d0)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                  }}
                >
                  {section.text}
                </div>
                {section.eventIds && section.eventIds.length > 0 && (
                  <div
                    className="event-chips"
                    style={{
                      padding: '4px 10px 8px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                    }}
                  >
                    {section.eventIds.map((eventId) => (
                      <span
                        key={eventId}
                        className="event-chip"
                        style={{
                          display: 'inline-block',
                          background: 'var(--accent-dim, rgba(74, 158, 255, 0.15))',
                          border: '1px solid var(--accent-border, rgba(74, 158, 255, 0.3))',
                          borderRadius: 3,
                          padding: '1px 6px',
                          fontSize: 10,
                          color: 'var(--accent, #4a9eff)',
                        }}
                      >
                        {eventId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Vertical resize handle */}
        <div
          className="resize-handle resize-handle-v"
          onMouseDown={handleVerticalMouseDown}
          style={{
            width: 4,
            cursor: 'col-resize',
            background: 'var(--border, #333)',
            flexShrink: 0,
          }}
        />

        {/* Right pane: Video preview placeholder */}
        <div
          className="playback-panel-container"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-panel, #1a1a1a)',
            overflow: 'hidden',
          }}
        >
          <div
            className="panel-header"
            style={{
              padding: '6px 12px',
              background: 'var(--bg-panel-header, #141414)',
              borderBottom: '1px solid var(--border, #333)',
              fontSize: 12,
              color: 'var(--text-secondary, #888)',
            }}
          >
            Preview
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted, #555)',
              fontSize: 12,
            }}
          >
            Video preview will appear here
          </div>
        </div>
      </div>

      {/* Horizontal resize handle */}
      <div
        className="resize-handle resize-handle-h"
        onMouseDown={handleHorizontalMouseDown}
        style={{
          height: 4,
          cursor: 'row-resize',
          background: 'var(--border, #333)',
          flexShrink: 0,
        }}
      />

      {/* Bottom: Timeline placeholder */}
      <div
        className="timeline-container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel, #1a1a1a)',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div
          className="panel-header"
          style={{
            padding: '6px 12px',
            background: 'var(--bg-panel-header, #141414)',
            borderBottom: '1px solid var(--border, #333)',
            fontSize: 12,
            color: 'var(--text-secondary, #888)',
          }}
        >
          Timeline
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted, #555)',
            fontSize: 12,
          }}
        >
          Timeline will appear here
        </div>
      </div>
    </div>
  )
}
