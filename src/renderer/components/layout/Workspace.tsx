import { useUIStore } from '../../stores/ui-store'
import { Toolbar } from './Toolbar'
import { PanelSystem } from './PanelSystem'

export function Workspace(): React.ReactNode {
  const workspacePreset = useUIStore((s) => s.workspacePreset)

  return (
    <div className="workspace">
      <Toolbar />
      <PanelSystem preset={workspacePreset} />
    </div>
  )
}
