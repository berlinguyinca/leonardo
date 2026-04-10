import { Workspace } from './components/layout/Workspace'
import { ProjectWizard } from './components/project/ProjectWizard'
import { useUIStore } from './stores/ui-store'

export function App(): React.ReactNode {
  const theme = useUIStore((s) => s.theme)

  return (
    <div className={`app ${theme}`} data-theme={theme}>
      <ProjectWizard />
      <Workspace />
    </div>
  )
}
