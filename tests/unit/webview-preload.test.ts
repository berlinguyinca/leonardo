// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron ipcRenderer before importing the preload module
const sendToHost = vi.fn()

vi.mock('electron', () => ({
  ipcRenderer: {
    sendToHost: (...args: unknown[]) => sendToHost(...args),
  },
}))

// Import the preload module — side effect registers the window 'message' listener
import '../../src/preload/webview-preload'

function dispatchMessageEvent(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data }))
}

describe('webview-preload', () => {
  beforeEach(() => {
    sendToHost.mockClear()
  })

  it('forwards events with __leonardoEvent: true via sendToHost', () => {
    const payload = { __leonardoEvent: true, type: 'click', target: '#btn' }
    dispatchMessageEvent(payload)
    expect(sendToHost).toHaveBeenCalledOnce()
    expect(sendToHost).toHaveBeenCalledWith('dom-event', payload)
  })

  it('ignores events without the __leonardoEvent flag', () => {
    dispatchMessageEvent({ type: 'click', target: '#btn' })
    expect(sendToHost).not.toHaveBeenCalled()
  })

  it('ignores events with __leonardoEvent: false', () => {
    dispatchMessageEvent({ __leonardoEvent: false, type: 'scroll' })
    expect(sendToHost).not.toHaveBeenCalled()
  })
})
