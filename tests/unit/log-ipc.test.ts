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
const mockClearLog = vi.fn()

vi.mock('@main/utils/logger', () => ({
  readLog: () => mockReadLog(),
  clearLog: () => mockClearLog(),
}))

vi.mock('@main/ipc/security', () => ({
  assertTrustedIPCEvent: vi.fn(),
}))

vi.mock('@shared/constants', () => ({
  IPC_CHANNELS: {
    LOG_READ: 'log:read',
    LOG_CLEAR: 'log:clear',
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

  it('registers a handler on the log:clear channel', () => {
    expect(mockIpcHandlers.has('log:clear')).toBe(true)
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

  it('rejects when readLog throws', async () => {
    mockReadLog.mockImplementation(() => { throw new Error('read error') })

    await expect(invokeHandle('log:read')).rejects.toThrow('read error')
  })

  it('calls clearLog when log:clear is invoked', async () => {
    await invokeHandle('log:clear')

    expect(mockClearLog).toHaveBeenCalledTimes(1)
  })

  it('rejects when clearLog throws', async () => {
    mockClearLog.mockImplementation(() => { throw new Error('clear error') })

    await expect(invokeHandle('log:clear')).rejects.toThrow('clear error')
  })
})
