import { create } from 'zustand'
import { temporal } from 'zundo'
import type { SyncTimeline, SyncPoint, Track, Segment, Clip, OverlayType } from '@shared/types'
import { defaultOverlayMetadata } from '@shared/types'
import { UNDO_HISTORY_LIMIT, TIMELINE_SEGMENT_MIN_DURATION_MS } from '@shared/constants'
import type { ScriptSection } from '@shared/types/ai'

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
  splitClipBySections: (segmentId: string, sections: ScriptSection[]) => void
  adjustSegmentDuration: (segmentId: string, newDurationMs: number) => void
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
      splitClipBySections: (segmentId, sections) =>
        set((state) => {
          if (!state.timeline || sections.length === 0) return state

          // Find the segment and its track
          let originalSegment: Segment | undefined
          let trackIndex = -1
          for (let i = 0; i < state.timeline.tracks.length; i++) {
            const seg = state.timeline.tracks[i].segments.find((s) => s.id === segmentId)
            if (seg) {
              originalSegment = seg
              trackIndex = i
              break
            }
          }

          if (!originalSegment || trackIndex === -1) return state

          const originalDuration = originalSegment.endTime - originalSegment.startTime
          const originalStartTime = originalSegment.startTime

          // Calculate total word count across all sections
          const totalWordCount = sections.reduce(
            (sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length,
            0,
          )

          if (totalWordCount === 0) return state

          // Build replacement segments proportional to word count
          const newSegments: Segment[] = []
          let accumulatedTime = originalStartTime

          for (const section of sections) {
            const sectionWordCount = section.text.split(/\s+/).filter(Boolean).length
            const sectionDuration = (sectionWordCount / totalWordCount) * originalDuration
            const segStartTime = accumulatedTime
            const segEndTime = segStartTime + sectionDuration

            newSegments.push({
              id: crypto.randomUUID(),
              trackId: originalSegment.trackId,
              startTime: segStartTime,
              endTime: segEndTime,
              sourceFile: originalSegment.sourceFile,
              sourceOffset: segStartTime - originalStartTime,
              sourceDuration: sectionDuration,
              label: section.text.slice(0, 40),
              metadata: JSON.stringify({ sectionId: section.id, sectionOrder: section.order }),
            })

            accumulatedTime = segEndTime
          }

          const updatedTracks = state.timeline.tracks.map((t, i) => {
            if (i !== trackIndex) return t
            return {
              ...t,
              segments: t.segments.flatMap((s) =>
                s.id === segmentId ? newSegments : [s],
              ),
            }
          })

          return {
            timeline: {
              ...state.timeline,
              tracks: updatedTracks,
              duration: computeDuration(updatedTracks),
            },
          }
        }),
      adjustSegmentDuration: (segmentId, newDurationMs) =>
        set((state) => {
          if (!state.timeline) return state

          // Find the segment and its track
          let originalSegment: Segment | undefined
          let trackIndex = -1
          for (let i = 0; i < state.timeline.tracks.length; i++) {
            const seg = state.timeline.tracks[i].segments.find((s) => s.id === segmentId)
            if (seg) {
              originalSegment = seg
              trackIndex = i
              break
            }
          }

          if (!originalSegment || trackIndex === -1) return state

          const duration = Math.max(newDurationMs, TIMELINE_SEGMENT_MIN_DURATION_MS)
          const originalEnd = originalSegment.endTime
          const delta = duration - (originalEnd - originalSegment.startTime)

          if (delta === 0) return state

          const updatedTracks = state.timeline.tracks.map((t, i) => {
            if (i !== trackIndex) return t
            return {
              ...t,
              segments: t.segments.map((s) => {
                if (s.id === segmentId) {
                  return { ...s, endTime: s.startTime + duration }
                }
                // Shift all subsequent segments in the same track
                if (s.startTime >= originalEnd) {
                  return { ...s, startTime: s.startTime + delta, endTime: s.endTime + delta }
                }
                return s
              }),
            }
          })

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
let lastSaveErrorTime = 0

useTimelineStore.subscribe((state) => {
  if (state.timeline !== prevTimeline && state.timeline) {
    prevTimeline = state.timeline
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && window.leonardo?.timeline) {
        window.leonardo.timeline.save(state.timeline!).catch((err: unknown) => {
          console.error('[Timeline] Auto-save failed:', err)
          // Throttle error toasts to avoid spam during repeated failures
          const now = Date.now()
          if (now - lastSaveErrorTime > 10000) {
            lastSaveErrorTime = now
            // Dynamic import to avoid circular dependency at module load
            import('./toast-store').then(({ useToastStore }) => {
              useToastStore.getState().addToast('Timeline save failed', 'warning')
            })
          }
        })
      }
    }, DEBOUNCE_MS)
  }
})
