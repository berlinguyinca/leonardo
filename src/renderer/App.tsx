import { useEffect } from 'react'
import { Workspace } from './components/layout/Workspace'
import { ProjectWizard } from './components/project/ProjectWizard'
import { LogViewer } from './components/settings/LogViewer'
import { useUIStore } from './stores/ui-store'
import { useProjectStore } from './stores/project-store'

export function App(): React.ReactNode {
  const theme = useUIStore((s) => s.theme)
  const showLogViewer = useUIStore((s) => s.showLogViewer)

  useEffect(() => {
    if (!window.leonardo?.project?.list) return
    window.leonardo.project.list().then((projects) => {
      useProjectStore.getState().setProjects(projects)
    })
    // Restore last active project
    if (window.leonardo?.settings?.get) {
      window.leonardo.settings.get('lastActiveProjectId').then((id) => {
        if (id) useProjectStore.getState().setActiveProject(id)
      })
    }
  }, [])

  return (
    <div className={`app ${theme}`} data-theme={theme}>
      <ProjectWizard />
      <Workspace />
      {showLogViewer && <LogViewer />}
    </div>
  )
}
