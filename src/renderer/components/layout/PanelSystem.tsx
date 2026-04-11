import { useCallback, useRef } from 'react'
import type { WorkspacePreset } from '../../stores/ui-store'
import { useUIStore } from '../../stores/ui-store'
import { useScriptStore } from '../../stores/script-store'
import { RecordingBrowser } from '../browser/RecordingBrowser'
import { PropertiesPanel } from '../properties/PropertiesPanel'
import { ScriptOnlyView } from '../script-editor/ScriptOnlyView'
import { DualPaneView } from '../script-editor/DualPaneView'
import { InlineEditorView } from '../script-editor/InlineEditorView'
import { ClipLibrary } from '../clip-library/ClipLibrary'

const COLLAPSED_SIZE = 36

interface PanelSystemProps {
  preset: WorkspacePreset
}

export function PanelSystem({ preset }: PanelSystemProps): React.ReactNode {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth)
  const timelineHeight = useUIStore((s) => s.timelineHeight)
  const setTimelineHeight = useUIStore((s) => s.setTimelineHeight)

  const editorView = useUIStore((s) => s.editorView)

  const sections = useScriptStore((s) => s.sections)
  const updateSection = useScriptStore((s) => s.updateSection)

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const propertiesCollapsed = useUIStore((s) => s.propertiesCollapsed)
  const timelineCollapsed = useUIStore((s) => s.timelineCollapsed)
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed)
  const setPropertiesCollapsed = useUIStore((s) => s.setPropertiesCollapsed)
  const setTimelineCollapsed = useUIStore((s) => s.setTimelineCollapsed)

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

  const effectiveTimelineHeight = timelineCollapsed ? COLLAPSED_SIZE : timelineHeight

  return (
    <div className="panel-system">
      {/* Left Sidebar - Clip Library */}
      <aside
        className={`panel panel-sidebar ${sidebarCollapsed ? 'panel-collapsed' : ''}`}
        style={{ width: sidebarCollapsed ? COLLAPSED_SIZE : sidebarWidth }}
      >
        <div
          className="panel-header panel-header-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          <span className={`collapse-chevron ${sidebarCollapsed ? 'chevron-right' : 'chevron-left'}`}>
            {sidebarCollapsed ? '\u25B6' : '\u25C0'}
          </span>
          {!sidebarCollapsed && <span>Library</span>}
        </div>
        {!sidebarCollapsed && (
          <div className="panel-content">
            <ClipLibrary />
          </div>
        )}
      </aside>

      {/* Sidebar Resize Handle */}
      {!sidebarCollapsed && (
        <div className="resize-handle resize-handle-v" onMouseDown={handleMouseDown('sidebar')} />
      )}

      {/* Main Content Area */}
      <div className="panel-main">
        {/* Top Section - Browser/Preview + Properties */}
        <div className="panel-top" style={{ height: `calc(100% - ${effectiveTimelineHeight}px - 4px)` }}>
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

          {/* Properties Panel */}
          <div
            className={`panel panel-properties ${propertiesCollapsed ? 'panel-collapsed' : ''}`}
            style={{ width: propertiesCollapsed ? COLLAPSED_SIZE : 300 }}
          >
            <div
              className="panel-header panel-header-toggle"
              onClick={() => setPropertiesCollapsed(!propertiesCollapsed)}
            >
              <span className={`collapse-chevron ${propertiesCollapsed ? 'chevron-left' : 'chevron-right'}`}>
                {propertiesCollapsed ? '\u25C0' : '\u25B6'}
              </span>
              {!propertiesCollapsed && <span>Properties</span>}
            </div>
            {!propertiesCollapsed && (
              <div className="panel-content">
                <PropertiesPanel />
              </div>
            )}
          </div>
        </div>

        {/* Timeline Resize Handle — editing/export only */}
        {preset !== 'recording' && !timelineCollapsed && (
          <div className="resize-handle resize-handle-h" onMouseDown={handleMouseDown('timeline')} />
        )}

        {/* Bottom Section - Timeline — editing/export only */}
        {preset !== 'recording' && <div
          className={`panel panel-timeline ${timelineCollapsed ? 'panel-collapsed' : ''}`}
          style={{ height: effectiveTimelineHeight }}
        >
          <div
            className="panel-header panel-header-toggle"
            onClick={() => setTimelineCollapsed(!timelineCollapsed)}
          >
            <span className={`collapse-chevron ${timelineCollapsed ? 'chevron-up' : 'chevron-down'}`}>
              {timelineCollapsed ? '\u25B2' : '\u25BC'}
            </span>
            <span>Timeline</span>
          </div>
          {!timelineCollapsed && (
            <div className="panel-content">
              {editorView === 'script-only' && (
                <ScriptOnlyView sections={sections} onUpdateSection={updateSection} />
              )}
              {editorView === 'dual-pane' && (
                <DualPaneView sections={sections} onUpdateSection={updateSection} />
              )}
              {editorView === 'inline' && (
                <InlineEditorView />
              )}
            </div>
          )}
        </div>}
      </div>
    </div>
  )
}
