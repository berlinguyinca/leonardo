// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mock electron before any source imports ----
// Use vi.hoisted so that variables referenced inside vi.mock factories are
// available after hoisting (vi.mock is moved before all imports by vitest).
const { mockIpcHandlers } = vi.hoisted(() => ({
  mockIpcHandlers: new Map<string, Function>(),
}))

vi.mock('electron', () => {
  const app = { getPath: (_name: string) => '/tmp/test-userData' }
  const ipcMain = {
    handle: (channel: string, handler: Function) => {
      mockIpcHandlers.set(channel, handler)
    },
  }
  const dialog = {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  }
  return { ipcMain, app, dialog }
})

vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
}))

const mockCreateProject = vi.fn()
const mockGetProject = vi.fn()
const mockListProjects = vi.fn()
const mockUpdateProject = vi.fn()
const mockDeleteProject = vi.fn()
const mockGetDatabase = vi.fn()

vi.mock('@main/services/project-store', () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  getProject: (...args: unknown[]) => mockGetProject(...args),
  listProjects: (...args: unknown[]) => mockListProjects(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}))

const mockGetSetting = vi.fn()
const mockSetSetting = vi.fn()

vi.mock('@main/services/settings', () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
  setSetting: (...args: unknown[]) => mockSetSetting(...args),
}))

const mockExportArchive = vi.fn()
const mockImportArchive = vi.fn()

vi.mock('@main/services/archive', () => ({
  exportArchive: (...args: unknown[]) => mockExportArchive(...args),
  importArchive: (...args: unknown[]) => mockImportArchive(...args),
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    PROJECT_CREATE: 'project:create',
    PROJECT_GET: 'project:get',
    PROJECT_LIST: 'project:list',
    PROJECT_UPDATE: 'project:update',
    PROJECT_DELETE: 'project:delete',
    ARCHIVE_EXPORT: 'archive:export',
    ARCHIVE_IMPORT: 'archive:import',
    SETTINGS_GET: 'settings:get',
    SETTINGS_SET: 'settings:set',
  },
}))

import { dialog } from 'electron'
import { registerProjectIPC } from '@main/ipc/project.ipc'
import { makeProject } from '@test/factories'

// Patch the CJS require cache so that inline `require('electron')` inside handler
// bodies (project.ipc.ts:80) returns our mock object rather than the electron binary path.
// vi.mock intercepts ESM import bindings but NOT CJS require() calls at runtime.
const electronMockForRequire = {
  app: { getPath: (_name: string) => '/tmp/test-userData' },
  ipcMain: { handle: (_ch: string, _h: Function) => {} },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
}
const electronModulePath = require.resolve('electron')
;(require as NodeRequire & { cache: Record<string, unknown> }).cache[electronModulePath] = {
  id: electronModulePath,
  filename: electronModulePath,
  loaded: true,
  exports: electronMockForRequire,
  children: [],
  paths: [],
  parent: null,
} as unknown as NodeModule

const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: { getURL: () => 'file:///renderer/index.html' },
}

async function invokeHandle(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, ...args)
}

describe('project IPC handlers', () => {
  beforeEach(() => {
    mockIpcHandlers.clear()
    vi.clearAllMocks()

    // Default db stub for ARCHIVE_EXPORT
    mockGetDatabase.mockReturnValue({ name: '/tmp/test.db', prepare: vi.fn() })

    registerProjectIPC()
  })

  // -----------------------------------------------------------------------
  // PROJECT_CREATE
  // -----------------------------------------------------------------------
  describe('project:create', () => {
    it('delegates to createProject with a generated uuid and returns the result', async () => {
      const project = makeProject()
      mockCreateProject.mockReturnValue(project)

      const result = await invokeHandle('project:create', {
        name: 'My Project',
        inputMode: 'record-first',
        resolution: { width: 1920, height: 1080, label: '1080p' },
      })

      expect(mockCreateProject).toHaveBeenCalledWith(
        'test-uuid',
        'My Project',
        'record-first',
        { width: 1920, height: 1080, label: '1080p' },
      )
      expect(result).toEqual(project)
    })
  })

  // -----------------------------------------------------------------------
  // PROJECT_GET
  // -----------------------------------------------------------------------
  describe('project:get', () => {
    it('delegates to getProject and returns the project', async () => {
      const project = makeProject({ id: 'proj-42' })
      mockGetProject.mockReturnValue(project)

      const result = await invokeHandle('project:get', 'proj-42')

      expect(mockGetProject).toHaveBeenCalledWith('proj-42')
      expect(result).toEqual(project)
    })

    it('returns null when the project does not exist', async () => {
      mockGetProject.mockReturnValue(null)

      const result = await invokeHandle('project:get', 'missing')

      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // PROJECT_LIST
  // -----------------------------------------------------------------------
  describe('project:list', () => {
    it('delegates to listProjects and returns all projects', async () => {
      const projects = [makeProject(), makeProject({ id: 'proj-2', name: 'Second' })]
      mockListProjects.mockReturnValue(projects)

      const result = await invokeHandle('project:list')

      expect(mockListProjects).toHaveBeenCalledTimes(1)
      expect(result).toEqual(projects)
    })
  })

  // -----------------------------------------------------------------------
  // PROJECT_UPDATE
  // -----------------------------------------------------------------------
  describe('project:update', () => {
    it('delegates to updateProject with id and partial updates', async () => {
      const updated = makeProject({ name: 'Renamed' })
      mockUpdateProject.mockReturnValue(updated)

      const result = await invokeHandle('project:update', {
        id: 'proj-1',
        updates: { name: 'Renamed' },
      })

      expect(mockUpdateProject).toHaveBeenCalledWith('proj-1', { name: 'Renamed' })
      expect(result).toEqual(updated)
    })
  })

  // -----------------------------------------------------------------------
  // PROJECT_DELETE
  // -----------------------------------------------------------------------
  describe('project:delete', () => {
    it('delegates to deleteProject and returns true', async () => {
      mockDeleteProject.mockReturnValue(true)

      const result = await invokeHandle('project:delete', 'proj-del')

      expect(mockDeleteProject).toHaveBeenCalledWith('proj-del')
      expect(result).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // ARCHIVE_EXPORT
  // -----------------------------------------------------------------------
  describe('archive:export', () => {
    it('shows a save dialog, calls exportArchive, and returns the output path', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: '/exports/my-project.leonardo',
        canceled: false,
      })
      mockExportArchive.mockReturnValue('/exports/my-project.leonardo')

      const result = await invokeHandle('archive:export', {
        projectId: 'proj-1',
        mediaFiles: ['/recordings/clip.mp4'],
        thumbnailFiles: ['/thumbs/t1.jpg'],
        settings: { theme: 'dark' },
      })

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({ filters: [{ name: 'Leonardo Project', extensions: ['leonardo'] }] }),
      )
      expect(mockExportArchive).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          dbPath: '/tmp/test.db',
          mediaFiles: ['/recordings/clip.mp4'],
          thumbnailFiles: ['/thumbs/t1.jpg'],
          settings: { theme: 'dark' },
          outputPath: '/exports/my-project.leonardo',
        }),
      )
      expect(result).toBe('/exports/my-project.leonardo')
    })

    it('returns null when user cancels the save dialog', async () => {
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        filePath: undefined,
        canceled: true,
      })

      const result = await invokeHandle('archive:export', {
        projectId: 'proj-1',
        mediaFiles: [],
        thumbnailFiles: [],
        settings: {},
      })

      expect(mockExportArchive).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // ARCHIVE_IMPORT
  // -----------------------------------------------------------------------
  describe('archive:import', () => {
    it('shows an open dialog, calls importArchive, and returns the result', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        filePaths: ['/downloads/project.leonardo'],
        canceled: false,
      })
      const importResult = {
        dbPath: '/tmp/test-userData/imports/test-uuid/project.db',
        mediaDir: '/tmp/test-userData/imports/test-uuid/media',
        thumbnailsDir: '/tmp/test-userData/imports/test-uuid/thumbnails',
        settings: {},
      }
      mockImportArchive.mockReturnValue(importResult)

      const result = await invokeHandle('archive:import')

      expect(dialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [{ name: 'Leonardo Project', extensions: ['leonardo'] }],
          properties: ['openFile'],
        }),
      )
      expect(mockImportArchive).toHaveBeenCalledWith(
        '/downloads/project.leonardo',
        '/tmp/test-userData/imports/test-uuid',
      )
      expect(result).toEqual(importResult)
    })

    it('returns null when user cancels the open dialog', async () => {
      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        filePaths: [],
        canceled: true,
      })

      const result = await invokeHandle('archive:import')

      expect(mockImportArchive).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // SETTINGS_GET
  // -----------------------------------------------------------------------
  describe('settings:get', () => {
    it('delegates to getSetting and returns the value', async () => {
      mockGetSetting.mockReturnValue('dark')

      const result = await invokeHandle('settings:get', 'theme')

      expect(mockGetSetting).toHaveBeenCalledWith('theme')
      expect(result).toBe('dark')
    })

    it('returns null when the setting does not exist', async () => {
      mockGetSetting.mockReturnValue(null)

      const result = await invokeHandle('settings:get', 'nonexistent')

      expect(result).toBeNull()
    })
  })

  // -----------------------------------------------------------------------
  // SETTINGS_SET
  // -----------------------------------------------------------------------
  describe('settings:set', () => {
    it('delegates to setSetting with the key/value pair', async () => {
      mockSetSetting.mockReturnValue(undefined)

      await invokeHandle('settings:set', { key: 'theme', value: 'light' })

      expect(mockSetSetting).toHaveBeenCalledWith('theme', 'light')
    })
  })
})
