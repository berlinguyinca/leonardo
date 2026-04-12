import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'

type IPCEvent = IpcMainEvent | IpcMainInvokeEvent

function isTrustedURL(url: string): boolean {
  if (!url) return false

  if (url.startsWith('file://')) {
    return true
  }

  const devServerUrl = process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    try {
      const trusted = new URL(devServerUrl)
      const candidate = new URL(url)
      return trusted.origin === candidate.origin
    } catch {
      return false
    }
  }

  return false
}

export function assertTrustedIPCEvent(event: IPCEvent): void {
  const senderURL = event.senderFrame?.url ?? event.sender.getURL()
  if (!isTrustedURL(senderURL)) {
    throw new Error(`Blocked IPC from untrusted sender: ${senderURL || '<empty>'}`)
  }
}
