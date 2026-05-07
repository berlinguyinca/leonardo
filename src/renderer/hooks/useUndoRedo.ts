import { useEffect } from 'react'
import { useProjectStore } from '../stores/project-store'
import { useTimelineStore } from '../stores/timeline-store'

/**
 * Global keyboard shortcuts — mounted once in Workspace.
 * Only handles shortcuts that should work regardless of which panel is focused.
 * Timeline-specific shortcuts (arrows, J/K/L, etc.) live in Timeline.tsx.
 */
export function useUndoRedo(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Undo/Redo
      if (isMod && e.key === 'z') {
        e.preventDefault()
        const projectTemporal = useProjectStore.temporal.getState()
        const timelineTemporal = useTimelineStore.temporal.getState()
        if (e.shiftKey) {
          projectTemporal.redo()
          timelineTemporal.redo()
        } else {
          projectTemporal.undo()
          timelineTemporal.undo()
        }
        return
      }

      // Space: play/pause (only when not in a text input)
      if (e.key === ' ' && !isInput) {
        e.preventDefault()
        const store = useTimelineStore.getState()
        store.setIsPlaying(!store.isPlaying)
        return
      }
    }

    // Prevent button activation from keyup when space is used for play/pause.
    // Browsers activate focused <button> elements on keyup for Space — calling
    // preventDefault on keyup suppresses that activation so the keydown handler
    // is the single source of truth for the space toggle.
    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (e.key === ' ' && !isInput) {
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
}
