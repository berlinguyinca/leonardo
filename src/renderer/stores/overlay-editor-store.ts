import { create } from 'zustand'

type EditorMode = 'select' | 'text' | 'drag'

interface OverlayEditorState {
  selectedElementId: string | null
  editorMode: EditorMode
  setSelectedElement: (id: string | null) => void
  setEditorMode: (mode: EditorMode) => void
}

export const useOverlayEditorStore = create<OverlayEditorState>((set) => ({
  selectedElementId: null,
  editorMode: 'select',
  setSelectedElement: (id) => set({ selectedElementId: id }),
  setEditorMode: (mode) => set({ editorMode: mode }),
}))
