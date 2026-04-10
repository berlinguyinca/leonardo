import { create } from 'zustand'
import type { Clip } from '@shared/types/events'

interface LibraryState {
  clips: Clip[]
  highlightedClipId: string | null

  addClip: (clip: Clip) => void
  removeClip: (id: string) => void
  setHighlightedClip: (id: string | null) => void
}

export const useLibraryStore = create<LibraryState>((set) => ({
  clips: [],
  highlightedClipId: null,

  addClip: (clip) =>
    set((state) => ({ clips: [clip, ...state.clips] })),
  removeClip: (id) =>
    set((state) => ({ clips: state.clips.filter((c) => c.id !== id) })),
  setHighlightedClip: (id) => set({ highlightedClipId: id }),
}))
