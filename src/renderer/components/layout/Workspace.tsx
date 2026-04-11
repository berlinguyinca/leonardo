import { useEffect } from 'react'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'
import { useScriptStore } from '../../stores/script-store'
import { Toolbar } from './Toolbar'
import { PanelSystem } from './PanelSystem'

export function Workspace(): React.ReactNode {
  const workspacePreset = useUIStore((s) => s.workspacePreset)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const loadProjectScripts = useScriptStore((s) => s.loadProjectScripts)

  useEffect(() => {
    if (!activeProjectId || !window.leonardo?.script) return
    window.leonardo.script.listByProject(activeProjectId)
      .then((scripts) => {
        loadProjectScripts(
          scripts
            .filter((s) => s.clipId != null)
            .map((s) => ({ clipId: s.clipId!, sections: s.sections })),
        )
      })
      .catch(() => {
        // Script pre-loading failed; scripts will be generated fresh as needed
      })
  }, [activeProjectId, loadProjectScripts])

  return (
    <div className="workspace">
      <Toolbar />
      <PanelSystem preset={workspacePreset} />
    </div>
  )
}
