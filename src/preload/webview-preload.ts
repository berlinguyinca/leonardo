import { ipcRenderer } from 'electron'

window.addEventListener('message', (event) => {
  const data = event.data
  if (data && data.__leonardoEvent === true) {
    ipcRenderer.sendToHost('dom-event', data)
  }
})
