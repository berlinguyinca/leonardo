import { create } from 'zustand'
import { temporal } from 'zundo'
import type { Project } from '@shared/types'
import { UNDO_HISTORY_LIMIT } from '@shared/constants'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  loading: boolean

  setProjects: (projects: Project[]) => void
  setActiveProject: (id: string | null) => void
  setLoading: (loading: boolean) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  removeProject: (id: string) => void
}

export const useProjectStore = create<ProjectState>()(
  temporal(
    (set) => ({
      projects: [],
      activeProjectId: null,
      loading: false,

      setProjects: (projects) => set({ projects }),
      setActiveProject: (id) => set({ activeProjectId: id }),
      setLoading: (loading) => set({ loading }),
      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),
      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
          ),
        })),
      removeProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        })),
    }),
    { limit: UNDO_HISTORY_LIMIT },
  ),
)
