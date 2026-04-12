import { useEffect } from 'react'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'
import { useScriptStore } from '../../stores/script-store'
import { useTimelineStore } from '../../stores/timeline-store'
import { useComposeStore } from '../../stores/compose-store'
import { Toolbar } from './Toolbar'
import { PanelSystem } from './PanelSystem'
import { ProjectHome } from '../project/ProjectHome'

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

  // Load timeline from database when project becomes active
  useEffect(() => {
    if (!activeProjectId || !window.leonardo?.timeline) {
      useTimelineStore.getState().setTimeline(null)
      return
    }
    window.leonardo.timeline.get(activeProjectId)
      .then((timeline) => {
        useTimelineStore.getState().setTimeline(timeline)
        if (timeline) {
          const segments = timeline.tracks.flatMap((t) =>
            t.segments.map((s) => ({
              id: s.id,
              label: s.label,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
          )
          useComposeStore.getState().syncFromTimeline(segments, {})
        }
      })
      .catch(() => {
        useTimelineStore.getState().setTimeline(null)
      })
  }, [activeProjectId])

  return (
    <div className="workspace">
      <Toolbar />
      {activeProjectId ? (
        <PanelSystem preset={workspacePreset} />
      ) : (
        <ProjectHome />
      )}
    </div>
  )
}
