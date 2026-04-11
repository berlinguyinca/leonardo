import { ipcRenderer } from 'electron'

interface LeonardoEvent {
  __leonardoEvent: true
  [key: string]: unknown
}

function isLeonardoEvent(data: unknown): data is LeonardoEvent {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__leonardoEvent' in data &&
    (data as LeonardoEvent).__leonardoEvent === true
  )
}

window.addEventListener('message', (event) => {
  if (isLeonardoEvent(event.data)) {
    ipcRenderer.sendToHost('dom-event', event.data)
  }
})
