import { app, BrowserWindow, shell, protocol, net } from 'electron'
import { join, normalize, extname } from 'path'
import { existsSync, statSync, createReadStream } from 'fs'
import { registerProjectIPC } from './ipc/project.ipc'
import { registerRecordingIPC } from './ipc/recording.ipc'
import { registerAIIPC } from './ipc/ai.ipc'
import { registerClipIPC } from './ipc/clip.ipc'
import { registerLogIPC } from './ipc/log.ipc'
import { registerTimelineIPC } from './ipc/timeline.ipc'
import { registerTTSIPC } from './ipc/tts.ipc'
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

  // Serve local media files via media:// protocol with Range request support for video streaming
  const MIME_TYPES: Record<string, string> = {
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  }

  protocol.handle('media', (request) => {
    const filePath = decodeURIComponent(request.url.slice('media://'.length))
    const normalized = normalize(filePath)
    if (!normalized.startsWith('/') || normalized.includes('..')) {
      return new Response('Forbidden: invalid path', { status: 403 })
    }
    if (!existsSync(normalized)) {
      console.error(`[media://] File not found: ${normalized}`)
      return new Response('Not found', { status: 404 })
    }

    const fileSize = statSync(normalized).size
    const mimeType = MIME_TYPES[extname(normalized).toLowerCase()] ?? 'application/octet-stream'
    const rangeHeader = request.headers.get('Range')

    // Handle Range requests (required for video/audio seeking)
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
        const chunkSize = end - start + 1
        const stream = createReadStream(normalized, { start, end })
        return new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': String(chunkSize),
            'Content-Type': mimeType,
            'Accept-Ranges': 'bytes',
          },
        })
      }
    }

    // Full file response with Accept-Ranges so the browser knows it can seek
    const stream = createReadStream(normalized)
    return new Response(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
      },
    })
  })
  registerProjectIPC()
  registerRecordingIPC()
  registerAIIPC()
  registerClipIPC()
  registerLogIPC()
  registerTimelineIPC()
  registerTTSIPC()
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
