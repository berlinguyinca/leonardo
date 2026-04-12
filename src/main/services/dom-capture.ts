import { webContents } from 'electron'
import type { DOMEvent } from '@shared/types/events'
import { getDOMEventInjectionScript } from './dom-event-injector'
import { v4 as uuidv4 } from 'uuid'

type EventCallback = (event: DOMEvent) => void

const capturedEvents: Map<number, DOMEvent[]> = new Map()
const listeners: Map<number, EventCallback> = new Map()
const navigationListeners: Map<number, () => void> = new Map()

export function startCapture(webContentsId: number, onEvent?: EventCallback): void {
  capturedEvents.set(webContentsId, [])
  if (onEvent) listeners.set(webContentsId, onEvent)

  const wc = webContents.fromId(webContentsId)
  if (!wc) return

  const existingListener = navigationListeners.get(webContentsId)
  if (existingListener) {
    wc.off('did-finish-load', existingListener)
  }

  // Inject the capture script on the current page
  injectScript(wc)

  // Re-inject on subsequent navigations
  const onDidFinishLoad = () => {
    injectScript(wc)
  }
  navigationListeners.set(webContentsId, onDidFinishLoad)
  wc.on('did-finish-load', onDidFinishLoad)
}

export function stopCapture(webContentsId: number): DOMEvent[] {
  const events = capturedEvents.get(webContentsId) ?? []
  capturedEvents.delete(webContentsId)
  listeners.delete(webContentsId)

  const wc = webContents.fromId(webContentsId)
  const navigationListener = navigationListeners.get(webContentsId)
  if (wc && navigationListener) {
    wc.off('did-finish-load', navigationListener)
  }
  navigationListeners.delete(webContentsId)

  return events
}

export function getCapturedEvents(webContentsId: number): DOMEvent[] {
  return capturedEvents.get(webContentsId) ?? []
}

export function handleDOMEvent(webContentsId: number, rawEvent: RawDOMMessage): void {
  const events = capturedEvents.get(webContentsId)
  if (!events) return

  const domEvent: DOMEvent = {
    id: uuidv4(),
    type: rawEvent.type,
    timestamp: rawEvent.timestamp,
    elementSelector: rawEvent.elementSelector,
    coordinates: rawEvent.coordinates,
    elementText: rawEvent.elementText,
    url: rawEvent.url,
    value: rawEvent.value,
    tagName: rawEvent.tagName,
    alt: rawEvent.alt,
    title: rawEvent.title,
    ariaLabel: rawEvent.ariaLabel,
    ariaDescribedby: rawEvent.ariaDescribedby,
    href: rawEvent.href,
    elementType: rawEvent.elementType,
    role: rawEvent.role,
    name: rawEvent.name,
    placeholder: rawEvent.placeholder,
  }

  events.push(domEvent)
  listeners.get(webContentsId)?.(domEvent)
}

interface RawDOMMessage {
  __leonardoEvent: true
  type: DOMEvent['type']
  timestamp: number
  elementSelector: string
  coordinates: { x: number; y: number }
  elementText?: string
  url?: string
  value?: string
  tagName?: string
  alt?: string
  title?: string
  ariaLabel?: string
  ariaDescribedby?: string
  href?: string
  elementType?: string
  role?: string
  name?: string
  placeholder?: string
}

export function isLeonardoEvent(data: unknown): data is RawDOMMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__leonardoEvent' in data &&
    (data as RawDOMMessage).__leonardoEvent === true
  )
}

function injectScript(wc: Electron.WebContents): void {
  wc.executeJavaScript(getDOMEventInjectionScript()).catch(() => {
    // Injection can fail if the page hasn't loaded yet — safe to ignore
  })
}
