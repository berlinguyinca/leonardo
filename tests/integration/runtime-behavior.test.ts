// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

// Mock electron before any project-store import
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test-electron',
  },
  ipcMain: {
    handle: vi.fn(),
  },
}))

import {
  initDatabase,
  closeDatabase,
  createProject,
  getProject,
  listProjects,
  deleteProject,
  createClip,
  listClips,
  saveTimeline,
  getTimeline,
} from '@main/services/project-store'
import { safeHandle } from '@main/ipc/safe-handle'
import type { SyncTimeline } from '@shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RES_1080P = { width: 1920, height: 1080, label: '1080p' }

function makeClip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'clip-rt-1',
    projectId: 'proj-rt-1',
    filePath: '/tmp/recording.webm',
    duration: 5000,
    url: '',
    resolution: { width: 1920, height: 1080 },
    createdAt: new Date().toISOString(),
    label: 'Runtime Clip',
    ...overrides,
  }
}

function makeTimeline(overrides: Partial<SyncTimeline> = {}): SyncTimeline {
  return {
    id: 'tl-rt-1',
    projectId: 'proj-rt-1',
    tracks: [
      {
        id: 'track-rt-1',
        type: 'clip',
        segments: [
          {
            id: 'seg-rt-1',
            trackId: 'track-rt-1',
            startTime: 0,
            endTime: 5000,
            sourceFile: '/tmp/recording.webm',
            sourceOffset: 0,
            label: 'Clip A',
          },
        ],
        zOrder: 0,
        label: 'Video',
        muted: false,
        locked: false,
      },
    ],
    syncPoints: [],
    duration: 5000,
    reviewed: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Group 1: Real SQLite persistence round-trips
// ---------------------------------------------------------------------------

describe('Group 1: Real SQLite persistence round-trips', () => {
  let tempDir: string
  let dbPath: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-rt-'))
    dbPath = join(tempDir, 'runtime.db')
    initDatabase(dbPath)
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates a project and retrieves it with matching fields', () => {
    createProject('proj-rt-1', 'Runtime Test', 'record-first', RES_1080P)
    const retrieved = getProject('proj-rt-1')

    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe('proj-rt-1')
    expect(retrieved!.name).toBe('Runtime Test')
    expect(retrieved!.inputMode).toBe('record-first')
    expect(retrieved!.status).toBe('draft')
    expect(retrieved!.recordingResolution).toEqual(RES_1080P)
    expect(retrieved!.createdAt).toBeDefined()
    expect(retrieved!.updatedAt).toBeDefined()
  })

  it('creates a project and it appears in listProjects', () => {
    createProject('proj-rt-2', 'Listed Project', 'prompt-first', RES_1080P)
    const projects = listProjects()

    const found = projects.find((p) => p.id === 'proj-rt-2')
    expect(found).toBeDefined()
    expect(found!.name).toBe('Listed Project')
  })

  it('creates a project, deletes it, and verifies it is gone', () => {
    createProject('proj-rt-del', 'Delete Me', 'simultaneous', RES_1080P)

    const beforeDelete = getProject('proj-rt-del')
    expect(beforeDelete).not.toBeNull()

    const deleted = deleteProject('proj-rt-del')
    expect(deleted).toBe(true)

    const afterDelete = getProject('proj-rt-del')
    expect(afterDelete).toBeNull()
  })

  it('creates a clip and it appears in listClips', () => {
    createProject('proj-rt-clip', 'Clip Owner', 'record-first', RES_1080P)
    const clip = makeClip({ id: 'clip-rt-a', projectId: 'proj-rt-clip' })
    createClip(clip)

    const clips = listClips('proj-rt-clip')
    expect(clips).toHaveLength(1)
    expect(clips[0].id).toBe('clip-rt-a')
    expect(clips[0].label).toBe('Runtime Clip')
    expect(clips[0].filePath).toBe('/tmp/recording.webm')
  })

  it('saves a timeline and retrieves it with matching structure', () => {
    createProject('proj-rt-1', 'TL Owner', 'record-first', RES_1080P)
    const tl = makeTimeline()
    saveTimeline(tl)

    const retrieved = getTimeline('proj-rt-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe('tl-rt-1')
    expect(retrieved!.projectId).toBe('proj-rt-1')
    expect(retrieved!.duration).toBe(5000)
    expect(retrieved!.reviewed).toBe(false)
    expect(retrieved!.tracks).toHaveLength(1)
    expect(retrieved!.tracks[0].segments).toHaveLength(1)
    expect(retrieved!.tracks[0].segments[0].sourceFile).toBe('/tmp/recording.webm')
  })
})

// ---------------------------------------------------------------------------
// Group 2: safeHandle error propagation
// ---------------------------------------------------------------------------

describe('Group 2: safeHandle error propagation', () => {
  it('re-throws when the handler throws — does not return {success: false}', async () => {
    const { ipcMain } = await import('electron')
    const mockedHandle = vi.mocked(ipcMain.handle)

    // safeHandle registers via ipcMain.handle — capture the wrapper it registers
    let capturedWrapper: ((event: unknown, ...args: unknown[]) => Promise<unknown>) | null = null
    mockedHandle.mockImplementationOnce((_channel, fn) => {
      capturedWrapper = fn as (event: unknown, ...args: unknown[]) => Promise<unknown>
    })

    safeHandle('test:error-channel', async () => {
      throw new Error('intentional handler failure')
    })

    expect(capturedWrapper).not.toBeNull()

    // The wrapper should re-throw, not return a structured error object
    await expect(capturedWrapper!({})).rejects.toThrow('intentional handler failure')
  })

  it('passes through the return value when the handler succeeds', async () => {
    const { ipcMain } = await import('electron')
    const mockedHandle = vi.mocked(ipcMain.handle)

    let capturedWrapper: ((event: unknown, ...args: unknown[]) => Promise<unknown>) | null = null
    mockedHandle.mockImplementationOnce((_channel, fn) => {
      capturedWrapper = fn as (event: unknown, ...args: unknown[]) => Promise<unknown>
    })

    safeHandle('test:success-channel', async () => ({ ok: true, value: 42 }))

    expect(capturedWrapper).not.toBeNull()
    const result = await capturedWrapper!({})
    expect(result).toEqual({ ok: true, value: 42 })
  })

  it('re-throws non-Error values thrown from a handler', async () => {
    const { ipcMain } = await import('electron')
    const mockedHandle = vi.mocked(ipcMain.handle)

    let capturedWrapper: ((event: unknown, ...args: unknown[]) => Promise<unknown>) | null = null
    mockedHandle.mockImplementationOnce((_channel, fn) => {
      capturedWrapper = fn as (event: unknown, ...args: unknown[]) => Promise<unknown>
    })

    safeHandle('test:string-throw-channel', async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw 'raw string error'
    })

    expect(capturedWrapper).not.toBeNull()
    await expect(capturedWrapper!({})).rejects.toBe('raw string error')
  })
})

// ---------------------------------------------------------------------------
// Group 3: Library store — no-bridge behavior
// ---------------------------------------------------------------------------

describe('Group 3: Library store — addClip without bridge updates local state', () => {
  beforeEach(() => {
    // Reset module registry so each test gets a fresh store
    vi.resetModules()
  })

  it('addClip updates local clips array when bridge is absent', async () => {
    // In a node environment window is undefined → hasBridge() returns false
    const { useLibraryStore } = await import('@renderer/stores/library-store')
    const store = useLibraryStore.getState()

    // Ensure clean slate
    useLibraryStore.setState({ clips: [] })

    const clip = makeClip({ id: 'clip-no-bridge' })
    await store.addClip(clip)

    const clips = useLibraryStore.getState().clips
    expect(clips).toHaveLength(1)
    expect(clips[0].id).toBe('clip-no-bridge')
  })

  it('removeClip cleans up related timeline segments and scripts', async () => {
    const { useLibraryStore } = await import('@renderer/stores/library-store')
    const { useTimelineStore } = await import('@renderer/stores/timeline-store')
    const { useScriptStore } = await import('@renderer/stores/script-store')

    const clip = makeClip({ id: 'clip-cleanup', filePath: '/tmp/clip-to-remove.webm' })

    // Seed state
    useLibraryStore.setState({ clips: [clip] })
    useScriptStore.setState({
      clipScripts: { 'clip-cleanup': [{ id: 'sec-x', text: 'hello', order: 0 } as never] },
    })
    useTimelineStore.setState({
      timeline: makeTimeline({
        tracks: [
          {
            id: 'track-cleanup',
            type: 'clip',
            segments: [
              {
                id: 'seg-cleanup',
                trackId: 'track-cleanup',
                startTime: 0,
                endTime: 5000,
                sourceFile: '/tmp/clip-to-remove.webm',
                sourceOffset: 0,
                label: 'Cleanup Seg',
              },
            ],
            zOrder: 0,
            label: 'Video',
            muted: false,
            locked: false,
          },
        ],
      }),
    })

    await useLibraryStore.getState().removeClip('clip-cleanup')

    // Clip removed from library
    expect(useLibraryStore.getState().clips).toHaveLength(0)

    // Script removed
    expect(useScriptStore.getState().clipScripts['clip-cleanup']).toBeUndefined()

    // Segments with that source file removed from timeline
    const tracks = useTimelineStore.getState().timeline?.tracks ?? []
    const remaining = tracks.flatMap((t) =>
      t.segments.filter((s) => s.sourceFile === '/tmp/clip-to-remove.webm'),
    )
    expect(remaining).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Group 4: Timeline auto-save subscriber
// ---------------------------------------------------------------------------

describe('Group 4: Timeline auto-save subscriber', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('fires the bridge save when timeline state changes', async () => {
    const saveSpy = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as Record<string, unknown>).window = {
      leonardo: { timeline: { save: saveSpy } },
    }

    const { useTimelineStore } = await import('@renderer/stores/timeline-store')
    const tl = makeTimeline({ id: 'tl-autosave-1', projectId: 'proj-autosave' })

    useTimelineStore.getState().setTimeline(tl)

    // Advance past the 1000ms debounce
    vi.advanceTimersByTime(1100)
    await Promise.resolve() // flush microtasks

    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'tl-autosave-1' }))

    delete (globalThis as Record<string, unknown>).window
  })

  it('debounces multiple rapid changes into a single save', async () => {
    const saveSpy = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as Record<string, unknown>).window = {
      leonardo: { timeline: { save: saveSpy } },
    }

    const { useTimelineStore } = await import('@renderer/stores/timeline-store')

    // Fire three rapid state changes
    for (let i = 0; i < 3; i++) {
      useTimelineStore.getState().setTimeline(makeTimeline({ id: `tl-rapid-${i}`, projectId: 'proj-autosave' }))
      vi.advanceTimersByTime(200)
    }

    // Only after enough time has passed should the save fire (once)
    vi.advanceTimersByTime(1100)
    await Promise.resolve()

    // Debounce: only the last change triggers exactly one save
    expect(saveSpy).toHaveBeenCalledTimes(1)

    delete (globalThis as Record<string, unknown>).window
  })
})
