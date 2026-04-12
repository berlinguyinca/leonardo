import { useEffect, useRef, useState } from 'react'
import { useComposeStore } from '../../stores/compose-store'

export function OperationLog(): React.ReactNode {
  const generationLog = useComposeStore((s) => s.generationLog)
  const isGenerating = useComposeStore((s) => s.isGenerating)
  const [collapsed, setCollapsed] = useState(false)
  const [startTime] = useState<number | null>(() => (isGenerating ? Date.now() : null))
  const [elapsed, setElapsed] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Subscribe to streaming events
  useEffect(() => {
    const leonardo = (window as unknown as Record<string, unknown>).leonardo as
      | { ai?: {
          onStreamChunk: (cb: (chunk: string) => void) => void
          removeStreamListeners: () => void
        } }
      | undefined

    if (!leonardo?.ai) return

    leonardo.ai.onStreamChunk((chunk: string) => {
      useComposeStore.getState().appendLogEntry({
        timestamp: Date.now(),
        level: 'info',
        message: chunk,
      })
    })

    return () => {
      leonardo.ai!.removeStreamListeners()
    }
  }, [])

  // Elapsed timer while generating
  useEffect(() => {
    if (!isGenerating) return
    const start = startTime ?? Date.now()
    const interval = setInterval(() => {
      setElapsed(Date.now() - start)
    }, 100)
    return () => clearInterval(interval)
  }, [isGenerating, startTime])

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [generationLog.length, collapsed])

  const handleCopyAll = () => {
    const text = generationLog
      .map((entry) => {
        const ts = new Date(entry.timestamp).toISOString()
        return `[${ts}] [${entry.level.toUpperCase()}] ${entry.message}`
      })
      .join('\n')
    navigator.clipboard.writeText(text)
  }

  const formatElapsed = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const levelColor = (level: string): string => {
    switch (level) {
      case 'warn':
        return 'var(--warning, #f59e0b)'
      case 'error':
        return 'var(--danger, #ef4444)'
      default:
        return 'var(--text-secondary, #888)'
    }
  }

  return (
    <div
      className="operation-log"
      style={{
        background: 'var(--bg-panel, #1a1a1a)',
        border: '1px solid var(--border, #333)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="operation-log-header"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'var(--bg-panel-header, #141414)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border, #333)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="collapse-chevron" style={{ fontSize: 10 }}>
            {collapsed ? '\u25B6' : '\u25BC'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #888)' }}>
            Operation Log
          </span>
          {isGenerating && (
            <span
              className="elapsed-time"
              style={{
                fontSize: 10,
                color: 'var(--accent, #4a9eff)',
                marginLeft: 8,
              }}
            >
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
        {!collapsed && generationLog.length > 0 && (
          <button
            className="copy-all-btn"
            onClick={(e) => {
              e.stopPropagation()
              handleCopyAll()
            }}
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
            Copy All
          </button>
        )}
      </div>

      {/* Log entries */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="operation-log-entries"
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            padding: '6px 10px',
            fontFamily: 'monospace',
            fontSize: 11,
          }}
        >
          {generationLog.length === 0 && (
            <div style={{ color: 'var(--text-muted, #555)', fontSize: 11 }}>
              No log entries yet.
            </div>
          )}
          {generationLog.map((entry, i) => (
            <div
              key={i}
              className={`log-entry log-entry-${entry.level}`}
              style={{
                color: levelColor(entry.level),
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ opacity: 0.6, marginRight: 6 }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              {entry.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
