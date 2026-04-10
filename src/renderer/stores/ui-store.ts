import { create } from 'zustand'

export type Theme = 'dark' | 'light'
export type WorkspacePreset = 'recording' | 'editing' | 'export'
export type EditorView = 'script-only' | 'dual-pane' | 'inline'

interface UIState {
  theme: Theme
  workspacePreset: WorkspacePreset
  editorView: EditorView
  showProjectWizard: boolean
  sidebarWidth: number
  timelineHeight: number

  setTheme: (theme: Theme) => void
  setWorkspacePreset: (preset: WorkspacePreset) => void
  setEditorView: (view: EditorView) => void
  setShowProjectWizard: (show: boolean) => void
  setSidebarWidth: (width: number) => void
  setTimelineHeight: (height: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  workspacePreset: 'editing',
  editorView: 'dual-pane',
  showProjectWizard: false,
  sidebarWidth: 260,
  timelineHeight: 300,

  setTheme: (theme) => set({ theme }),
  setWorkspacePreset: (preset) => set({ workspacePreset: preset }),
  setEditorView: (view) => set({ editorView: view }),
  setShowProjectWizard: (show) => set({ showProjectWizard: show }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setTimelineHeight: (height) => set({ timelineHeight: height }),
}))
