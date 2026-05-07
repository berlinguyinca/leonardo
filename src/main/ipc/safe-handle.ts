import { ipcMain } from 'electron'

/**
 * Wraps an IPC handler with structured logging.
 * Errors are re-thrown so that ipcRenderer.invoke() rejects on the renderer side,
 * allowing standard try/catch error handling in the UI layer.
 */
export function safeHandle(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[IPC] ${channel} error:`, message)
      throw err
    }
  })
}
