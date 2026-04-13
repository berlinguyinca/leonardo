import { vi } from 'vitest'

export const mockIpcHandlers: Map<string, Function> = new Map()
export const mockIpcListeners: Map<string, Function> = new Map()

/**
 * Call vi.mock('electron', ...) with this factory BEFORE importing IPC modules.
 * Usage: vi.mock('electron', () => electronMock())
 */
export function electronMock() {
  return {
    ipcMain: {
      handle: (channel: string, handler: Function) => {
        mockIpcHandlers.set(channel, handler)
      },
      on: (channel: string, handler: Function) => {
        mockIpcListeners.set(channel, handler)
      },
    },
    app: {
      getPath: (_name: string) => '/tmp/test-userData',
    },
    dialog: {
      showSaveDialog: vi.fn(),
      showOpenDialog: vi.fn(),
    },
  }
}

export const TRUSTED_EVENT = {
  senderFrame: { url: 'file:///renderer/index.html' },
  sender: {
    getURL: () => 'file:///renderer/index.html',
    isDestroyed: () => false,
    send: vi.fn(),
  },
}

export async function invokeHandle(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcHandlers.get(channel)
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`)
  return handler(TRUSTED_EVENT, ...args)
}

export function emitOn(channel: string, ...args: unknown[]): void {
  const listener = mockIpcListeners.get(channel)
  if (!listener) throw new Error(`No listener registered for channel: ${channel}`)
  listener(TRUSTED_EVENT, ...args)
}

export function resetIpcMocks(): void {
  mockIpcHandlers.clear()
  mockIpcListeners.clear()
}
