import { useUIStore } from '../../stores/ui-store'
import type { WorkspacePreset } from '../../stores/ui-store'
import { ViewModeToggle } from './ViewModeToggle'

export function Toolbar(): React.ReactNode {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const workspacePreset = useUIStore((s) => s.workspacePreset)
  const setWorkspacePreset = useUIStore((s) => s.setWorkspacePreset)
  const setShowProjectWizard = useUIStore((s) => s.setShowProjectWizard)
  const setShowLogViewer = useUIStore((s) => s.setShowLogViewer)

  const presets: WorkspacePreset[] = ['recording', 'editing', 'export']

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-title">Leonardo</h1>
        <button
          className="toolbar-btn"
          onClick={() => setShowProjectWizard(true)}
        >
          New Project
        </button>
      </div>

      <nav className="toolbar-center">
        {presets.map((preset) => (
          <button
            key={preset}
            className={`toolbar-preset ${workspacePreset === preset ? 'active' : ''}`}
            onClick={() => setWorkspacePreset(preset)}
          >
            {preset.charAt(0).toUpperCase() + preset.slice(1)}
          </button>
        ))}
      </nav>

      <div className="toolbar-right">
        <ViewModeToggle />
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
