import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { Project, InputModeType, Resolution } from '@shared/types/project'

// In-memory store until SQLite is set up (Task 3)
const projects: Map<string, Project> = new Map()

export function registerProjectIPC(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_CREATE,
    async (_event, args: { name: string; inputMode: InputModeType; resolution: Resolution }) => {
      const { v4: uuidv4 } = await import('uuid')
      const project: Project = {
        id: uuidv4(),
        name: args.name,
        inputMode: args.inputMode,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recordingResolution: args.resolution,
        exportConfig: null,
      }
      projects.set(project.id, project)
      return project
    },
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (_event, id: string) => {
    return projects.get(id) ?? null
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    return Array.from(projects.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_UPDATE,
    async (_event, args: { id: string; updates: Partial<Project> }) => {
      const project = projects.get(args.id)
      if (!project) return null
      const updated = { ...project, ...args.updates, updatedAt: new Date().toISOString() }
      projects.set(args.id, updated)
      return updated
    },
  )

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, id: string) => {
    return projects.delete(id)
  })
}
