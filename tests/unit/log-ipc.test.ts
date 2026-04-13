// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- mock electron before any source imports ----
const mockIpcHandlers: Map<string, Function> = new Map()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Function) => {
      mockIpcHandlers.set(channel, handler)
    },
  },
}))

const mockReadLog = vi.fn()

vi.mock('@main/utils/logger', () => ({
  readLog: () => mockReadLog(),
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    LOG_READ: 'log:read',
  },
}))

import { registerLogIPC } from '@main/ipc/log.ipc'

const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: { getURL: () => 'file:///renderer/index.html' },
}

async function invokeHandle(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, ...args)
}

describe('log IPC handlers', () => {
  beforeEach(() => {
    mockIpcHandlers.clear()
    vi.clearAllMocks()
    registerLogIPC()
  })

  it('registers a handler on the log:read channel', () => {
    expect(mockIpcHandlers.has('log:read')).toBe(true)
  })

  it('delegates to readLog and returns log content', async () => {
    mockReadLog.mockReturnValue('INFO line one\nWARN line two\n')

    const result = await invokeHandle('log:read')

    expect(mockReadLog).toHaveBeenCalledTimes(1)
    expect(result).toBe('INFO line one\nWARN line two\n')
  })

  it('returns empty string when readLog returns empty string', async () => {
    mockReadLog.mockReturnValue('')

    const result = await invokeHandle('log:read')

    expect(result).toBe('')
  })
})
