import { useEffect } from 'react'
import { useProjectStore } from '../stores/project-store'
import { useTimelineStore } from '../stores/timeline-store'

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

      // Delete/Backspace: remove selected sync point or segment
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        e.preventDefault()
        const store = useTimelineStore.getState()
        if (store.selectedSyncPointId) {
          store.removeSyncPoint(store.selectedSyncPointId)
          store.setSelectedSyncPoint(null)
        }
        return
      }

      // +/-: zoom
      if ((e.key === '+' || e.key === '=') && !isInput) {
        useTimelineStore.getState().setZoomLevel(
          Math.min(10, useTimelineStore.getState().zoomLevel * 1.2),
        )
        return
      }
      if (e.key === '-' && !isInput) {
        useTimelineStore.getState().setZoomLevel(
          Math.max(0.1, useTimelineStore.getState().zoomLevel / 1.2),
        )
        return
      }

      // Home/End: jump playhead
      if (e.key === 'Home' && !isInput) {
        useTimelineStore.getState().setPlayheadPosition(0)
        return
      }
      if (e.key === 'End' && !isInput) {
        const duration = useTimelineStore.getState().timeline?.duration ?? 0
        useTimelineStore.getState().setPlayheadPosition(duration)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
