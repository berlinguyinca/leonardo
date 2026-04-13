// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'

// ---- mock electron before any imports that use it ----
const mockIpcHandlers: Map<string, Function> = new Map()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Function) => {
      mockIpcHandlers.set(channel, handler)
    },
    on: () => {},
  },
  app: {
    getPath: (_name: string) => '/tmp/test-userData',
  },
  dialog: {
    showSaveDialog: vi.fn(),
  },
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

vi.mock('@main/utils/ffmpeg', () => ({
  extractThumbnails: vi.fn().mockResolvedValue([]),
}))

// Trusted IPC event that satisfies assertTrustedIPCEvent (which is mocked)
const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: { getURL: () => 'file:///renderer/index.html' },
}

async function invokeHandle(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, ...args)
}

import { initDatabase, closeDatabase, createProject } from '@main/services/project-store'
import { registerClipIPC } from '@main/ipc/clip.ipc'
import { IPC_CHANNELS } from '@shared/constants'
import type { Clip } from '@shared/types/events'

function makeClip(overrides?: Partial<Clip>): Clip {
  return {
    id: 'clip-1',
    projectId: 'proj-1',
    filePath: '/recordings/clip-1/clip.mp4',
    duration: 5000,
    url: 'https://example.com',
    resolution: { width: 1920, height: 1080 },
    createdAt: new Date().toISOString(),
    label: 'Test Clip',
    ...overrides,
  }
}

describe('clip IPC → project-store → SQLite integration', () => {
  let tempDir: string

  beforeEach(() => {
    mockIpcHandlers.clear()
    tempDir = mkdtempSync(join(tmpdir(), 'leonardo-clip-ipc-test-'))
    const dbPath = join(tempDir, 'test.db')
    initDatabase(dbPath)
    createProject('proj-1', 'Test Project', 'record-first', {
      width: 1920,
      height: 1080,
      label: '1080p',
    })
    registerClipIPC()
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('CLIP_CREATE + CLIP_LIST round trip returns the created clip', async () => {
    const clip = makeClip()
    await invokeHandle(IPC_CHANNELS.CLIP_CREATE, clip)

    const clips = (await invokeHandle(IPC_CHANNELS.CLIP_LIST)) as Clip[]
    expect(clips).toHaveLength(1)
    expect(clips[0].id).toBe('clip-1')
    expect(clips[0].label).toBe('Test Clip')
    expect(clips[0].duration).toBe(5000)
  })

  it('CLIP_LIST filters by projectId', async () => {
    createProject('proj-2', 'Other Project', 'record-first', {
      width: 1280,
      height: 720,
      label: '720p',
    })

    const clipA = makeClip({ id: 'clip-a', projectId: 'proj-1', label: 'Clip A' })
    const clipB = makeClip({ id: 'clip-b', projectId: 'proj-2', label: 'Clip B' })
    await invokeHandle(IPC_CHANNELS.CLIP_CREATE, clipA)
    await invokeHandle(IPC_CHANNELS.CLIP_CREATE, clipB)

    const proj1Clips = (await invokeHandle(IPC_CHANNELS.CLIP_LIST, 'proj-1')) as Clip[]
    expect(proj1Clips).toHaveLength(1)
    expect(proj1Clips[0].id).toBe('clip-a')

    const proj2Clips = (await invokeHandle(IPC_CHANNELS.CLIP_LIST, 'proj-2')) as Clip[]
    expect(proj2Clips).toHaveLength(1)
    expect(proj2Clips[0].id).toBe('clip-b')
  })

  it('CLIP_DELETE removes the clip from DB', async () => {
    const clip = makeClip()
    await invokeHandle(IPC_CHANNELS.CLIP_CREATE, clip)

    const before = (await invokeHandle(IPC_CHANNELS.CLIP_LIST)) as Clip[]
    expect(before).toHaveLength(1)

    await invokeHandle(IPC_CHANNELS.CLIP_DELETE, 'clip-1')

    const after = (await invokeHandle(IPC_CHANNELS.CLIP_LIST)) as Clip[]
    expect(after).toHaveLength(0)
  })

  it('multiple clips can coexist per project', async () => {
    const clipIds = ['clip-x', 'clip-y', 'clip-z']
    for (const id of clipIds) {
      await invokeHandle(IPC_CHANNELS.CLIP_CREATE, makeClip({ id, label: `Label ${id}` }))
    }

    const clips = (await invokeHandle(IPC_CHANNELS.CLIP_LIST, 'proj-1')) as Clip[]
    expect(clips).toHaveLength(3)
    const ids = clips.map((c) => c.id).sort()
    expect(ids).toEqual(['clip-x', 'clip-y', 'clip-z'])
  })
})
