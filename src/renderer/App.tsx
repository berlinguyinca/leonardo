import { Workspace } from './components/layout/Workspace'
import { ProjectWizard } from './components/project/ProjectWizard'
import { LogViewer } from './components/settings/LogViewer'
import { useUIStore } from './stores/ui-store'

export function App(): React.ReactNode {
  const theme = useUIStore((s) => s.theme)
  const showLogViewer = useUIStore((s) => s.showLogViewer)

  return (
    <div className={`app ${theme}`} data-theme={theme}>
      <ProjectWizard />
      <Workspace />
      {showLogViewer && <LogViewer />}
    </div>
  )
}
