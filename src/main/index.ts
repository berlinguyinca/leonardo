import { app, BrowserWindow, shell, protocol, net } from 'electron'
import { join } from 'path'
import { registerProjectIPC } from './ipc/project.ipc'
import { registerRecordingIPC } from './ipc/recording.ipc'
import { registerAIIPC } from './ipc/ai.ipc'
import { registerClipIPC } from './ipc/clip.ipc'
import { registerLogIPC } from './ipc/log.ipc'
import { registerTimelineIPC } from './ipc/timeline.ipc'
import { initDatabase, closeDatabase } from './services/project-store'
import { initLogger } from './utils/logger'

// Register media:// scheme before app ready — enables streaming local video/image files
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { stream: true, bypassCSP: true, supportFetchAPI: true } },
])

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
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

  // Serve local media files via media:// protocol (works in both dev and production)
  protocol.handle('media', (request) => {
    // filePath is absolute (starts with /), so file:// + /path = file:///path (correct)
    const filePath = decodeURIComponent(request.url.slice('media:///'.length))
    return net.fetch(`file://${filePath}`)
  })
  registerProjectIPC()
  registerRecordingIPC()
  registerAIIPC()
  registerClipIPC()
  registerLogIPC()
  registerTimelineIPC()
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
