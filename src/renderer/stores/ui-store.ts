import { create } from 'zustand'

export type Theme = 'dark' | 'light'
export type WorkspacePreset = 'recording' | 'compose' | 'script' | 'export' | 'effects'
export type EditorView = 'script-only' | 'inline'

interface PanelSnapshot {
  sidebarCollapsed: boolean
  propertiesCollapsed: boolean
  timelineCollapsed: boolean
}

interface UIState {
  theme: Theme
  workspacePreset: WorkspacePreset
  editorView: EditorView
  showProjectWizard: boolean
  showLogViewer: boolean
  sidebarWidth: number
  timelineHeight: number
  sidebarCollapsed: boolean
  propertiesCollapsed: boolean
  timelineCollapsed: boolean
  panelStateBeforeRecording: PanelSnapshot | null
  followPlayhead: boolean

  setTheme: (theme: Theme) => void
  setWorkspacePreset: (preset: WorkspacePreset) => void
  setEditorView: (view: EditorView) => void
  setShowProjectWizard: (show: boolean) => void
  setShowLogViewer: (show: boolean) => void
  setSidebarWidth: (width: number) => void
  setTimelineHeight: (height: number) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setPropertiesCollapsed: (collapsed: boolean) => void
  setTimelineCollapsed: (collapsed: boolean) => void
  collapseAllPanels: () => void
  restorePanelState: () => void
  setFollowPlayhead: (follow: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  workspacePreset: 'compose',
  editorView: 'inline',
  showProjectWizard: false,
  showLogViewer: false,
  sidebarWidth: 260,
  timelineHeight: 300,
  sidebarCollapsed: false,
  propertiesCollapsed: false,
  timelineCollapsed: false,
  panelStateBeforeRecording: null,
  followPlayhead: false,

  setTheme: (theme) => set({ theme }),
  setWorkspacePreset: (preset) => set({ workspacePreset: preset }),
  setEditorView: (view) => set({ editorView: view }),
  setShowProjectWizard: (show) => set({ showProjectWizard: show }),
  setShowLogViewer: (show) => set({ showLogViewer: show }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setTimelineHeight: (height) => set({ timelineHeight: height }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setPropertiesCollapsed: (collapsed) => set({ propertiesCollapsed: collapsed }),
  setTimelineCollapsed: (collapsed) => set({ timelineCollapsed: collapsed }),
  collapseAllPanels: () =>
    set((state) => ({
      panelStateBeforeRecording: {
        sidebarCollapsed: state.sidebarCollapsed,
        propertiesCollapsed: state.propertiesCollapsed,
        timelineCollapsed: state.timelineCollapsed,
      },
      sidebarCollapsed: true,
      propertiesCollapsed: true,
      timelineCollapsed: true,
    })),
  restorePanelState: () =>
    set((state) => {
      if (!state.panelStateBeforeRecording) return state
      return {
        sidebarCollapsed: state.panelStateBeforeRecording.sidebarCollapsed,
        propertiesCollapsed: state.panelStateBeforeRecording.propertiesCollapsed,
        timelineCollapsed: state.panelStateBeforeRecording.timelineCollapsed,
        panelStateBeforeRecording: null,
      }
    }),
  setFollowPlayhead: (follow) => set({ followPlayhead: follow }),
}))
