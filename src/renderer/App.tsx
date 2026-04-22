import { useEffect } from 'react'
import { Workspace } from './components/layout/Workspace'
import { ProjectWizard } from './components/project/ProjectWizard'
import { LogViewer } from './components/settings/LogViewer'
import { Toast } from './components/layout/Toast'
import { useUIStore } from './stores/ui-store'
import { useProjectStore } from './stores/project-store'
import { useToastStore } from './stores/toast-store'

export function App(): React.ReactNode {
  const theme = useUIStore((s) => s.theme)
  const showLogViewer = useUIStore((s) => s.showLogViewer)
  const loading = useProjectStore((s) => s.loading)

  useEffect(() => {
    async function init() {
      if (!window.leonardo?.project?.list) return
      useProjectStore.getState().setLoading(true)
      try {
        const projects = await window.leonardo.project.list()
        useProjectStore.getState().setProjects(projects)
      } catch (err) {
        console.error('[App] Failed to load projects:', err)
        useToastStore.getState().addToast('Failed to load projects', 'error')
        useProjectStore.getState().setLoading(false)
        return
      }
      // Restore last active project only after projects are loaded
      if (window.leonardo?.settings?.get) {
        try {
          const id = await window.leonardo.settings.get('lastActiveProjectId')
          if (id) useProjectStore.getState().setActiveProject(id)
        } catch {
          // Non-critical: app works without restoring last project
        }
      }
      useProjectStore.getState().setLoading(false)
    }
    init()
  }, [])

  return (
    <div className={`app ${theme}`} data-theme={theme}>
      {loading ? (
        <div className="app-loading">Loading...</div>
      ) : (
        <>
          <ProjectWizard />
          <Workspace />
        </>
      )}
      {showLogViewer && <LogViewer />}
      <Toast />
    </div>
  )
}
