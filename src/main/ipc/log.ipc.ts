import { IPC_CHANNELS } from '@shared/constants'
import { readLog, clearLog } from '../utils/logger'
import { assertTrustedIPCEvent } from './security'
import { safeHandle } from './safe-handle'

export function registerLogIPC(): void {
  safeHandle(IPC_CHANNELS.LOG_READ, async (event) => {
    assertTrustedIPCEvent(event)
    return readLog()
  })

  safeHandle(IPC_CHANNELS.LOG_CLEAR, async (event) => {
    assertTrustedIPCEvent(event)
    clearLog()
  })
}
