interface AIError {
  error: string
  provider: string
  model: string
  promptPreview: string
  fullPrompt: string
  stack?: string
  timestamp: number
}

interface ErrorLogProps {
  error: AIError | null
}

export function ErrorLog({ error }: ErrorLogProps): React.ReactNode {
  if (!error) return null

  const handleCopyReport = () => {
    const report = [
      '[Leonardo AI Error Report]',
      `Provider: ${error.provider}`,
      `Model: ${error.model}`,
      `Timestamp: ${new Date(error.timestamp).toISOString()}`,
      `Error: ${error.error}`,
      `Prompt: ${error.fullPrompt}`,
      `Stack: ${error.stack ?? 'N/A'}`,
    ].join('\n')
    navigator.clipboard.writeText(report)
  }

  return (
    <div
      className="error-log"
      style={{
        background: 'var(--bg-panel, #1a1a1a)',
        border: '1px solid var(--danger, #ff453a)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        className="error-log-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(255, 69, 58, 0.1)',
          borderBottom: '1px solid var(--danger, #ff453a)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger, #ff453a)' }}>
          AI Error
        </span>
        <button
          className="copy-error-btn"
          onClick={handleCopyReport}
          style={{
            background: 'var(--bg-hover, #252525)',
            color: 'var(--text-secondary, #888)',
            border: '1px solid var(--border, #333)',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Copy Error Report
        </button>
      </div>

      <div style={{ padding: '8px 10px', fontSize: 12 }}>
        <div className="error-field" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted, #555)' }}>Provider: </span>
          <span style={{ color: 'var(--text-primary, #d0d0d0)' }}>{error.provider}</span>
        </div>
        <div className="error-field" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted, #555)' }}>Model: </span>
          <span style={{ color: 'var(--text-primary, #d0d0d0)' }}>{error.model}</span>
        </div>
        <div className="error-field" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted, #555)' }}>Error: </span>
          <span style={{ color: 'var(--danger, #ff453a)' }}>{error.error}</span>
        </div>
        <div className="error-field" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted, #555)' }}>Prompt preview: </span>
          <span
            style={{
              color: 'var(--text-secondary, #888)',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            {error.promptPreview}
          </span>
        </div>
        {error.stack && (
          <div className="error-field">
            <div style={{ color: 'var(--text-muted, #555)', marginBottom: 2 }}>Stack:</div>
            <pre
              style={{
                color: 'var(--text-secondary, #888)',
                fontSize: 10,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'var(--bg-hover, #252525)',
                padding: 6,
                borderRadius: 4,
                maxHeight: 120,
                overflowY: 'auto',
                margin: 0,
              }}
            >
              {error.stack}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
