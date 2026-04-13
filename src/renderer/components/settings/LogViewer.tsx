import { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../stores/ui-store'

export function LogViewer(): React.ReactNode {
  const setShowLogViewer = useUIStore((s) => s.setShowLogViewer)
  const [logText, setLogText] = useState('')
  const [loading, setLoading] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  const fetchLog = async (): Promise<void> => {
    setLoading(true)
    try {
      const text = await window.leonardo.log.read()
      setLogText(text || '(No log entries yet)')
    } catch {
      setLogText('(Failed to read log file)')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLog()
  }, [])

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [logText])

  const handleCopy = (): void => {
    navigator.clipboard.writeText(logText)
  }

  const handleClear = async (): Promise<void> => {
    await window.leonardo.log.clear()
    setLogText('(Log cleared)')
  }

  return (
    <div className="log-viewer-overlay" onClick={() => setShowLogViewer(false)}>
      <div className="log-viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="log-viewer-header">
          <span className="log-viewer-title">Application Log</span>
          <div className="log-viewer-actions">
            <button className="toolbar-btn" onClick={fetchLog} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button className="toolbar-btn" onClick={handleCopy}>
              Copy
            </button>
            <button className="toolbar-btn" onClick={handleClear}>
              Clear Log
            </button>
            <button className="toolbar-btn" onClick={() => setShowLogViewer(false)}>
              ×
            </button>
          </div>
        </div>
        <pre className="log-viewer-content" ref={preRef}>
          {logText}
        </pre>
      </div>
    </div>
  )
}
