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

      // J/K/L — variable-speed transport (DaVinci Resolve style)
      if (e.key === 'l' && !isInput) {
        const s = useTimelineStore.getState()
        const next = s.isPlaying && s.playbackRate > 0 ? Math.min(s.playbackRate * 2, 8) : 1
        s.setPlaybackRate(next)
        s.setIsPlaying(true)
        return
      }
      if (e.key === 'k' && !isInput) {
        const s = useTimelineStore.getState()
        s.setIsPlaying(false)
        s.setPlaybackRate(1)
        return
      }
      if (e.key === 'j' && !isInput) {
        const s = useTimelineStore.getState()
        const next = s.isPlaying && s.playbackRate < 0 ? Math.max(s.playbackRate * 2, -8) : -1
        s.setPlaybackRate(next)
        s.setIsPlaying(true)
        return
      }

      // Arrow keys — step 5s (no shift) or jump to segment boundary (shift)
      if (e.key === 'ArrowRight' && !e.shiftKey && !isInput) {
        e.preventDefault()
        const s = useTimelineStore.getState()
        s.setIsPlaying(false)
        s.setPlayheadPosition(Math.min(s.timeline?.duration ?? 0, s.playheadPosition + 5000))
        return
      }
      if (e.key === 'ArrowLeft' && !e.shiftKey && !isInput) {
        e.preventDefault()
        const s = useTimelineStore.getState()
        s.setIsPlaying(false)
        s.setPlayheadPosition(Math.max(0, s.playheadPosition - 5000))
        return
      }
      if (e.key === 'ArrowRight' && e.shiftKey && !isInput) {
        e.preventDefault()
        jumpSegmentBoundary('next')
        return
      }
      if (e.key === 'ArrowLeft' && e.shiftKey && !isInput) {
        e.preventDefault()
        jumpSegmentBoundary('prev')
        return
      }
    }

    function jumpSegmentBoundary(dir: 'prev' | 'next') {
      const s = useTimelineStore.getState()
      const pos = s.playheadPosition
      const boundaries = Array.from(
        new Set(
          (s.timeline?.tracks ?? []).flatMap((t) =>
            t.segments.flatMap((seg) => [seg.startTime, seg.endTime]),
          ),
        ),
      ).sort((a, b) => a - b)

      const target =
        dir === 'next'
          ? boundaries.find((b) => b > pos)
          : [...boundaries].reverse().find((b) => b < pos)

      if (target !== undefined) s.setPlayheadPosition(target)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
