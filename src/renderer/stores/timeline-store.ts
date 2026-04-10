import { create } from 'zustand'
import { temporal } from 'zundo'
import type { SyncTimeline, SyncPoint, Track } from '@shared/types'
import { UNDO_HISTORY_LIMIT } from '@shared/constants'

interface TimelineState {
  timeline: SyncTimeline | null
  playheadPosition: number
  zoomLevel: number
  selectedSyncPointId: string | null
  selectedSegmentId: string | null
  isPlaying: boolean

  setTimeline: (timeline: SyncTimeline | null) => void
  setPlayheadPosition: (position: number) => void
  setZoomLevel: (zoom: number) => void
  setSelectedSyncPoint: (id: string | null) => void
  setSelectedSegment: (id: string | null) => void
  setIsPlaying: (playing: boolean) => void
  addSyncPoint: (point: SyncPoint) => void
  updateSyncPoint: (id: string, updates: Partial<SyncPoint>) => void
  removeSyncPoint: (id: string) => void
  addTrack: (track: Track) => void
  removeTrack: (id: string) => void
}

export const useTimelineStore = create<TimelineState>()(
  temporal(
    (set) => ({
      timeline: null,
      playheadPosition: 0,
      zoomLevel: 1,
      selectedSyncPointId: null,
      selectedSegmentId: null,
      isPlaying: false,

      setTimeline: (timeline) => set({ timeline }),
      setPlayheadPosition: (position) => set({ playheadPosition: position }),
      setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
      setSelectedSyncPoint: (id) => set({ selectedSyncPointId: id }),
      setSelectedSegment: (id) => set({ selectedSegmentId: id }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      addSyncPoint: (point) =>
        set((state) => {
          if (!state.timeline) return state
          return {
            timeline: {
              ...state.timeline,
              syncPoints: [...state.timeline.syncPoints, point],
            },
          }
        }),
      updateSyncPoint: (id, updates) =>
        set((state) => {
          if (!state.timeline) return state
          return {
            timeline: {
              ...state.timeline,
              syncPoints: state.timeline.syncPoints.map((sp) =>
                sp.id === id ? { ...sp, ...updates } : sp,
              ),
            },
          }
        }),
      removeSyncPoint: (id) =>
        set((state) => {
          if (!state.timeline) return state
          return {
            timeline: {
              ...state.timeline,
              syncPoints: state.timeline.syncPoints.filter((sp) => sp.id !== id),
            },
          }
        }),
      addTrack: (track) =>
        set((state) => {
          if (!state.timeline) return state
          return {
            timeline: {
              ...state.timeline,
              tracks: [...state.timeline.tracks, track],
            },
          }
        }),
      removeTrack: (id) =>
        set((state) => {
          if (!state.timeline) return state
          return {
            timeline: {
              ...state.timeline,
              tracks: state.timeline.tracks.filter((t) => t.id !== id),
            },
          }
        }),
    }),
    { limit: UNDO_HISTORY_LIMIT },
  ),
)
