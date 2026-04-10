import { useEffect } from 'react'
import { useProjectStore } from '../stores/project-store'
import { useTimelineStore } from '../stores/timeline-store'

export function useUndoRedo(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key !== 'z') return

      e.preventDefault()

      const projectTemporal = useProjectStore.temporal.getState()
      const timelineTemporal = useTimelineStore.temporal.getState()

      if (e.shiftKey) {
        // Redo
        projectTemporal.redo()
        timelineTemporal.redo()
      } else {
        // Undo
        projectTemporal.undo()
        timelineTemporal.undo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
