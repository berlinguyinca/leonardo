import { create } from 'zustand'
import { temporal } from 'zundo'
import type { SyncTimeline, SyncPoint, Track, Segment, Clip, OverlayType } from '@shared/types'
import { defaultOverlayMetadata } from '@shared/types'
import { UNDO_HISTORY_LIMIT } from '@shared/constants'

interface TimelineState {
  timeline: SyncTimeline | null
  playheadPosition: number
  zoomLevel: number
  selectedSyncPointId: string | null
  selectedSegmentId: string | null
  isPlaying: boolean
  playbackRate: number

  setTimeline: (timeline: SyncTimeline | null) => void
  setPlayheadPosition: (position: number) => void
  setZoomLevel: (zoom: number) => void
  setSelectedSyncPoint: (id: string | null) => void
  setSelectedSegment: (id: string | null) => void
  setIsPlaying: (playing: boolean) => void
  setPlaybackRate: (rate: number) => void
  addSyncPoint: (point: SyncPoint) => void
  updateSyncPoint: (id: string, updates: Partial<SyncPoint>) => void
  removeSyncPoint: (id: string) => void
  addTrack: (track: Track) => void
  removeTrack: (id: string) => void
  removeSegment: (segmentId: string) => void
  removeSegmentsBySourceFile: (sourceFile: string) => void
  addClipToTimeline: (clip: Clip, insertTimeMs?: number) => void
  addOverlaySegment: (overlayType: OverlayType, startTimeMs: number, durationMs?: number) => void
  updateSegmentMetadata: (segmentId: string, metadata: string) => void
  updateSegmentTiming: (segmentId: string, startTime: number, endTime: number) => void
}

function computeDuration(tracks: Track[]): number {
  return tracks.flatMap((t) => t.segments).reduce((max, s) => Math.max(max, s.endTime), 0)
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
      playbackRate: 1,

      setTimeline: (timeline) => set({ timeline }),
      setPlayheadPosition: (position) => set({ playheadPosition: position }),
      setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
      setSelectedSyncPoint: (id) => set({ selectedSyncPointId: id }),
      setSelectedSegment: (id) => set({ selectedSegmentId: id }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
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
      removeSegment: (segmentId) =>
        set((state) => {
          if (!state.timeline) return state
          const updatedTracks = state.timeline.tracks.map((t) => ({
            ...t,
            segments: t.segments.filter((s) => s.id !== segmentId),
          }))
          return {
            timeline: {
              ...state.timeline,
              tracks: updatedTracks,
              duration: computeDuration(updatedTracks),
            },
          }
        }),
      removeSegmentsBySourceFile: (sourceFile) =>
        set((state) => {
          if (!state.timeline) return state
          const updatedTracks = state.timeline.tracks.map((t) => ({
            ...t,
            segments: t.segments.filter((s) => s.sourceFile !== sourceFile),
          }))
          return {
            timeline: {
              ...state.timeline,
              tracks: updatedTracks,
              duration: computeDuration(updatedTracks),
            },
          }
        }),
      addClipToTimeline: (clip, insertTimeMs) =>
        set((state) => {
          if (clip.duration <= 0) return state

          const timeline = state.timeline ?? {
            id: crypto.randomUUID(),
            projectId: clip.projectId || '',
            tracks: [],
            syncPoints: [],
            duration: 0,
            reviewed: false,
          }

          const existingTrack = timeline.tracks.find(
            (t) => t.type === 'clip' || t.type === 'recording',
          )

          let startTime: number
          if (insertTimeMs !== undefined) {
            startTime = insertTimeMs
          } else if (existingTrack && existingTrack.segments.length > 0) {
            startTime = existingTrack.segments.reduce((max, s) => Math.max(max, s.endTime), 0)
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
            const updatedTracks = timeline.tracks.map((t) =>
              t.id === existingTrack.id
                ? { ...t, segments: [...t.segments, segment] }
                : t,
            )
            return {
              timeline: {
                ...timeline,
                tracks: updatedTracks,
                duration: computeDuration(updatedTracks),
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

          const newTracks = [...timeline.tracks, newTrack]
          return {
            timeline: {
              ...timeline,
              tracks: newTracks,
              duration: computeDuration(newTracks),
            },
          }
        }),
      addOverlaySegment: (overlayType, startTimeMs, durationMs = 3000) =>
        set((state) => {
          const timeline = state.timeline ?? {
            id: crypto.randomUUID(),
            projectId: '',
            tracks: [],
            syncPoints: [],
            duration: 0,
            reviewed: false,
          }

          const existingOverlayTrack = timeline.tracks.find((t) => t.type === 'overlay')
          const trackId = existingOverlayTrack?.id ?? crypto.randomUUID()

          const segment: Segment = {
            id: crypto.randomUUID(),
            trackId,
            startTime: startTimeMs,
            endTime: startTimeMs + durationMs,
            sourceFile: '',
            sourceOffset: 0,
            label: overlayType,
            metadata: JSON.stringify(defaultOverlayMetadata(overlayType)),
          }

          if (existingOverlayTrack) {
            const updatedTracks = timeline.tracks.map((t) =>
              t.id === existingOverlayTrack.id
                ? { ...t, segments: [...t.segments, segment] }
                : t,
            )
            return {
              timeline: {
                ...timeline,
                tracks: updatedTracks,
                duration: computeDuration(updatedTracks),
              },
            }
          }

          const newTrack: Track = {
            id: trackId,
            type: 'overlay',
            segments: [segment],
            zOrder: 10,
            label: 'Overlays',
            muted: false,
            locked: false,
          }

          const newTracks = [...timeline.tracks, newTrack]
          return {
            timeline: {
              ...timeline,
              tracks: newTracks,
              duration: computeDuration(newTracks),
            },
          }
        }),
      updateSegmentMetadata: (segmentId, metadata) =>
        set((state) => {
          if (!state.timeline) return state
          const updatedTracks = state.timeline.tracks.map((t) => ({
            ...t,
            segments: t.segments.map((s) =>
              s.id === segmentId ? { ...s, metadata } : s,
            ),
          }))
          return {
            timeline: {
              ...state.timeline,
              tracks: updatedTracks,
            },
          }
        }),
      updateSegmentTiming: (segmentId, startTime, endTime) =>
        set((state) => {
          if (!state.timeline) return state
          const updatedTracks = state.timeline.tracks.map((t) => ({
            ...t,
            segments: t.segments.map((s) =>
              s.id === segmentId ? { ...s, startTime, endTime } : s,
            ),
          }))
          return {
            timeline: {
              ...state.timeline,
              tracks: updatedTracks,
              duration: computeDuration(updatedTracks),
            },
          }
        }),
    }),
    { limit: UNDO_HISTORY_LIMIT },
  ),
)

// --- Auto-save subscriber: persist timeline to DB on changes ---
let prevTimeline: SyncTimeline | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 1000

useTimelineStore.subscribe((state) => {
  if (state.timeline !== prevTimeline && state.timeline) {
    prevTimeline = state.timeline
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && window.leonardo?.timeline) {
        window.leonardo.timeline.save(state.timeline!)
      }
    }, DEBOUNCE_MS)
  }
})
