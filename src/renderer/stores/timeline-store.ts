import { create } from 'zustand'
import { temporal } from 'zundo'
import type { SyncTimeline, SyncPoint, Track, Segment } from '@shared/types'
import type { Clip } from '@shared/types/events'
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
  addClipToTimeline: (clip: Clip, insertTimeMs?: number) => void
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
      addClipToTimeline: (clip, insertTimeMs) =>
        set((state) => {
          if (!state.timeline) return state

          const existingTrack = state.timeline.tracks.find(
            (t) => t.type === 'clip' || t.type === 'recording',
          )

          let startTime: number
          if (insertTimeMs !== undefined) {
            startTime = insertTimeMs
          } else if (existingTrack && existingTrack.segments.length > 0) {
            startTime = Math.max(...existingTrack.segments.map((s) => s.endTime))
          } else {
            startTime = 0
          }

          const trackId = existingTrack?.id ?? crypto.randomUUID()

          const segment: Segment = {
            id: crypto.randomUUID(),
            trackId,
            startTime,
            endTime: startTime + clip.duration,
            sourceFile: clip.filePath,
            sourceOffset: 0,
            label: clip.label,
          }

          if (existingTrack) {
            return {
              timeline: {
                ...state.timeline,
                tracks: state.timeline.tracks.map((t) =>
                  t.id === existingTrack.id
                    ? { ...t, segments: [...t.segments, segment] }
                    : t,
                ),
              },
            }
          }

          const newTrack: Track = {
            id: trackId,
            type: 'clip',
            segments: [segment],
            zOrder: 0,
            label: 'Recordings',
            muted: false,
            locked: false,
          }

          return {
            timeline: {
              ...state.timeline,
              tracks: [...state.timeline.tracks, newTrack],
            },
          }
        }),
    }),
    { limit: UNDO_HISTORY_LIMIT },
  ),
)
