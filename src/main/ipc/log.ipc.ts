import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { readLog } from '../utils/logger'
import { assertTrustedIPCEvent } from './security'

export function registerLogIPC(): void {
  ipcMain.handle(IPC_CHANNELS.LOG_READ, async (event) => {
    assertTrustedIPCEvent(event)
    return readLog()
  })
}
