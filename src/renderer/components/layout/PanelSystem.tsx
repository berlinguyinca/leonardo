import { useCallback, useRef } from 'react'
import type { WorkspacePreset } from '../../stores/ui-store'
import { useUIStore } from '../../stores/ui-store'
import { RecordingBrowser } from '../browser/RecordingBrowser'
import { PropertiesPanel } from '../properties/PropertiesPanel'
import { ScriptOnlyView } from '../script-editor/ScriptOnlyView'
import { DualPaneView } from '../script-editor/DualPaneView'
import { InlineEditorView } from '../script-editor/InlineEditorView'

interface PanelSystemProps {
  preset: WorkspacePreset
}

export function PanelSystem({ preset }: PanelSystemProps): React.ReactNode {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const timelineHeight = useUIStore((s) => s.timelineHeight)
  const setTimelineHeight = useUIStore((s) => s.setTimelineHeight)

  const editorView = useUIStore((s) => s.editorView)

  const isDraggingSidebar = useRef(false)
  const isDraggingTimeline = useRef(false)

  const handleMouseDown = useCallback(
    (target: 'sidebar' | 'timeline') => (e: React.MouseEvent) => {
      e.preventDefault()
      if (target === 'sidebar') isDraggingSidebar.current = true
      else isDraggingTimeline.current = true

      const handleMouseMove = (e: MouseEvent) => {
        if (isDraggingSidebar.current) {
          const newWidth = Math.max(200, Math.min(500, e.clientX))
          setSidebarWidth(newWidth)
        }
        if (isDraggingTimeline.current) {
          const newHeight = Math.max(150, Math.min(600, window.innerHeight - e.clientY))
          setTimelineHeight(newHeight)
        }
      }

      const handleMouseUp = () => {
        isDraggingSidebar.current = false
        isDraggingTimeline.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setSidebarWidth, setTimelineHeight],
  )

  return (
    <div className="panel-system">
      {/* Left Sidebar - Clip Library */}
      <aside className="panel panel-sidebar" style={{ width: sidebarWidth }}>
        <div className="panel-header">Library</div>
        <div className="panel-content">
          <p className="panel-placeholder">Clip Library</p>
        </div>
      </aside>

      {/* Sidebar Resize Handle */}
      <div className="resize-handle resize-handle-v" onMouseDown={handleMouseDown('sidebar')} />

      {/* Main Content Area */}
      <div className="panel-main">
        {/* Top Section - Browser/Preview + Properties */}
        <div className="panel-top" style={{ height: `calc(100% - ${timelineHeight}px - 4px)` }}>
          <div className="panel panel-preview">
            <div className="panel-header">
              {preset === 'recording' ? 'Browser' : 'Preview'}
            </div>
            <div className="panel-content">
              {preset === 'recording' ? (
                <RecordingBrowser />
              ) : (
                <p className="panel-placeholder">Video Preview</p>
              )}
            </div>
          </div>

          <div className="panel panel-properties">
            <div className="panel-header">Properties</div>
            <div className="panel-content">
              <PropertiesPanel />
            </div>
          </div>
        </div>

        {/* Timeline Resize Handle */}
        <div className="resize-handle resize-handle-h" onMouseDown={handleMouseDown('timeline')} />

        {/* Bottom Section - Timeline */}
        <div className="panel panel-timeline" style={{ height: timelineHeight }}>
          <div className="panel-content">
            {editorView === 'script-only' && (
              <ScriptOnlyView sections={[]} onUpdateSection={() => {}} />
            )}
            {editorView === 'dual-pane' && (
              <DualPaneView sections={[]} onUpdateSection={() => {}} />
            )}
            {editorView === 'inline' && (
              <InlineEditorView />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
