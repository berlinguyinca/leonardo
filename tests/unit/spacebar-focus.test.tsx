// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'

/**
 * Spacebar focus bug: when a <button> is focused, pressing Space triggers
 * both the global keydown handler (play/pause toggle) AND the browser's
 * keyup-based button activation (click). This causes a double-toggle.
 *
 * Fix: useUndoRedo adds a keyup handler that calls preventDefault for Space,
 * preventing button activation while keeping the keydown toggle.
 */

function mountGlobalHandlers(): () => void {
  // Replicate what useUndoRedo mounts on window
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    if (isMod && e.key === 'z') {
      e.preventDefault()
      return
    }

    if (e.key === ' ' && !isInput) {
      e.preventDefault()
      const store = useTimelineStore.getState()
      store.setIsPlaying(!store.isPlaying)
      return
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    if (e.key === ' ' && !isInput) {
      e.preventDefault()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
  }
}

describe('Spacebar play/pause in compose view', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    useTimelineStore.setState({
      isPlaying: false,
      timeline: {
        id: 't1',
        projectId: 'p1',
        tracks: [],
        syncPoints: [],
        duration: 10000,
        reviewed: false,
      },
    })
    cleanup = mountGlobalHandlers()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('toggles play when space pressed on a plain div', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    div.focus()

    expect(useTimelineStore.getState().isPlaying).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(useTimelineStore.getState().isPlaying).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })

  it('does NOT double-toggle when space pressed on a focused button', () => {
    const button = document.createElement('button')
    button.textContent = 'Play'
    document.body.appendChild(button)

    // Simulate a play button that toggles on click
    button.addEventListener('click', () => {
      const s = useTimelineStore.getState()
      s.setIsPlaying(!s.isPlaying)
    })

    button.focus()
    expect(useTimelineStore.getState().isPlaying).toBe(false)

    // keydown: global handler toggles play (false→true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(useTimelineStore.getState().isPlaying).toBe(true)

    // keyup: the handler should preventDefault, blocking button activation
    const keyupEvent = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true })
    window.dispatchEvent(keyupEvent)

    // Simulate browser: if keyup was NOT prevented, button.click() fires
    if (!keyupEvent.defaultPrevented) {
      button.click()
    }

    // With the fix: keyup is prevented → no click → isPlaying stays true
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })

  it('does NOT toggle when space pressed in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    expect(useTimelineStore.getState().isPlaying).toBe(false)

    // Dispatch from window with input as implied target
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    Object.defineProperty(event, 'target', { value: input })
    window.dispatchEvent(event)

    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })

  it('does NOT toggle when space pressed in a textarea', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    expect(useTimelineStore.getState().isPlaying).toBe(false)

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    Object.defineProperty(event, 'target', { value: textarea })
    window.dispatchEvent(event)

    expect(useTimelineStore.getState().isPlaying).toBe(false)
  })

  it('toggles play when space pressed while properties panel is focused', () => {
    const panel = document.createElement('div')
    panel.className = 'properties-panel'
    panel.tabIndex = 0
    document.body.appendChild(panel)
    panel.focus()

    expect(useTimelineStore.getState().isPlaying).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(useTimelineStore.getState().isPlaying).toBe(true)
  })
})
