import { useUIStore } from '../../stores/ui-store'
import type { WorkspacePreset } from '../../stores/ui-store'
import { ViewModeToggle } from './ViewModeToggle'

const MENU_ITEMS = ['File', 'Edit', 'View', 'Playback'] as const
const WORKSPACE_TABS: { preset: WorkspacePreset; label: string }[] = [
  { preset: 'recording', label: 'Record' },
  { preset: 'editing', label: 'Edit' },
  { preset: 'export', label: 'Export' },
]

export function Toolbar(): React.ReactNode {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const workspacePreset = useUIStore((s) => s.workspacePreset)
  const setWorkspacePreset = useUIStore((s) => s.setWorkspacePreset)
  const setShowProjectWizard = useUIStore((s) => s.setShowProjectWizard)
  const setShowLogViewer = useUIStore((s) => s.setShowLogViewer)

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        {MENU_ITEMS.map((item) => (
          <span key={item} className="toolbar-menu-item">{item}</span>
        ))}
      </div>

      <div className="toolbar-center">
        <span className="toolbar-brand">LEONARDO</span>
      </div>

      <div className="toolbar-right">
        {WORKSPACE_TABS.map(({ preset, label }) => (
          <button
            key={preset}
            className={`workspace-tab${workspacePreset === preset ? ' workspace-tab-active' : ''}`}
            title={`Switch to ${preset} workspace`}
            onClick={() => setWorkspacePreset(preset)}
          >
            {label}
          </button>
        ))}
        <div className="toolbar-right-divider" />
        {workspacePreset !== 'recording' && <ViewModeToggle />}
        <button
          className="toolbar-btn"
          onClick={() => setShowProjectWizard(true)}
        >
          New Project
        </button>
        <button
          className="toolbar-btn"
          onClick={() => setShowLogViewer(true)}
          title="View application log"
        >
          Logs
        </button>
        <button
          className="toolbar-btn toolbar-theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </header>
  )
}
