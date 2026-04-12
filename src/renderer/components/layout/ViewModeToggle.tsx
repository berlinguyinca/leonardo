import { useEffect } from 'react'
import { useUIStore } from '../../stores/ui-store'
import type { EditorView } from '../../stores/ui-store'

const VIEWS: { key: EditorView; label: string }[] = [
  { key: 'script-only', label: 'Script' },
  { key: 'inline', label: 'Timeline' },
]

export function ViewModeToggle(): React.ReactNode {
  const editorView = useUIStore((s) => s.editorView)
  const setEditorView = useUIStore((s) => s.setEditorView)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const index = parseInt(e.key, 10)
      if (index >= 1 && index <= VIEWS.length) {
        e.preventDefault()
        setEditorView(VIEWS[index - 1].key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setEditorView])

  return (
    <div className="view-mode-toggle" role="tablist" aria-label="Editor view">
      {VIEWS.map(({ key, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={editorView === key}
          className={`view-mode-btn ${editorView === key ? 'active' : ''}`}
          onClick={() => setEditorView(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
