import { app, BrowserWindow, shell, desktopCapturer } from 'electron'
import { join } from 'path'
import { registerProjectIPC } from './ipc/project.ipc'
import { registerRecordingIPC } from './ipc/recording.ipc'
import { registerAIIPC } from './ipc/ai.ipc'
import { registerClipIPC } from './ipc/clip.ipc'
import { registerLogIPC } from './ipc/log.ipc'
import { initDatabase, closeDatabase } from './services/project-store'
import { initLogger } from './utils/logger'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Leonardo',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Auto-approve screen capture requests for recording
  mainWindow.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (sources.length === 0) {
        callback({})
        return
      }
      callback({ video: sources[0] })
    }).catch(() => callback({}))
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const isDev = !app.isPackaged
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initLogger()
  initDatabase()
  registerProjectIPC()
  registerRecordingIPC()
  registerAIIPC()
  registerClipIPC()
  registerLogIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})
