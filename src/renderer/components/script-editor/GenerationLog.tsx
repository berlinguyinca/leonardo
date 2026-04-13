import { useState } from 'react'

export type AIProviderType = 'claude' | 'openai' | 'codex' | 'ollama'

export interface GenerationLog {
  systemPrompt: string
  userMessage: string
  rawResponse: string
  timestamp: string
  provider: AIProviderType
}

interface GenerationLogProps {
  log: GenerationLog | null
  onRegenerate: (customPrompt: string) => void
}

interface CollapsibleSectionProps {
  title: string
  content: string
}

function CollapsibleSection({ title, content }: CollapsibleSectionProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="generation-log-section">
      <button
        className="generation-log-section-header"
        onClick={() => setExpanded((prev) => !prev)}
        type="button"
      >
        <span>{expanded ? '▼' : '▶'}</span>
        <span>{title}</span>
      </button>
      {expanded && (
        <pre className="generation-log-section-content">{content}</pre>
      )}
    </div>
  )
}

export function GenerationLog({ log, onRegenerate }: GenerationLogProps): React.ReactNode {
  const [showPromptForm, setShowPromptForm] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

  if (!log) return null

  const formattedTime = new Date(log.timestamp).toLocaleString()

  function handleGenerate(): void {
    const trimmed = customPrompt.trim()
    onRegenerate(trimmed)
    setShowPromptForm(false)
    setCustomPrompt('')
  }

  function handleCancel(): void {
    setShowPromptForm(false)
    setCustomPrompt('')
  }

  return (
    <div className="generation-log">
      <div className="generation-log-header">
        <span>Generation Log</span>
        <span className="generation-log-meta">
          {log.provider} &middot; {formattedTime}
        </span>
      </div>

      <CollapsibleSection title="System Prompt" content={log.systemPrompt} />
      <CollapsibleSection title="User Message" content={log.userMessage} />
      <CollapsibleSection title="AI Response" content={log.rawResponse} />

      {!showPromptForm ? (
        <button
          className="generation-log-regenerate-btn rec-btn"
          onClick={() => setShowPromptForm(true)}
          type="button"
        >
          Regenerate with Custom Prompt
        </button>
      ) : (
        <div className="generation-log-prompt-form">
          <textarea
            className="generation-log-prompt-input"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter a custom prompt..."
            rows={4}
          />
          <div className="generation-log-prompt-actions">
            <button className="rec-btn" onClick={handleGenerate} type="button">
              Generate
            </button>
            <button className="rec-btn" onClick={handleCancel} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
