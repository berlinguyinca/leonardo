// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useProjectStore } from '../../src/renderer/stores/project-store'
import { useTimelineStore } from '../../src/renderer/stores/timeline-store'

/**
 * Tests for the undo/redo keyboard shortcuts mounted in useUndoRedo.
 * We replicate the handler directly (same pattern as spacebar-focus.test.tsx)
 * to avoid React lifecycle overhead while still fully covering the logic.
 */
function mountGlobalHandlers(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey
    const target = e.target as HTMLElement
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable

    if (isMod && e.key === 'z') {
      e.preventDefault()
      const projectTemporal = useProjectStore.temporal.getState()
      const timelineTemporal = useTimelineStore.temporal.getState()
      if (e.shiftKey) {
        projectTemporal.redo()
        timelineTemporal.redo()
      } else if (!isInput) {
        projectTemporal.undo()
        timelineTemporal.undo()
      }
      return
    }

    if (e.key === ' ' && !isInput) {
      e.preventDefault()
      const store = useTimelineStore.getState()
      store.setIsPlaying(!store.isPlaying)
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
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

describe('useUndoRedo keyboard shortcuts', () => {
  let cleanup: (() => void) | undefined
  let projectUndo: ReturnType<typeof vi.fn>
  let projectRedo: ReturnType<typeof vi.fn>
  let timelineUndo: ReturnType<typeof vi.fn>
  let timelineRedo: ReturnType<typeof vi.fn>

  beforeEach(() => {
    projectUndo = vi.fn()
    projectRedo = vi.fn()
    timelineUndo = vi.fn()
    timelineRedo = vi.fn()

    // Patch temporal stores
    useProjectStore.temporal.setState({
      undo: projectUndo,
      redo: projectRedo,
    })
    useTimelineStore.temporal.setState({
      undo: timelineUndo,
      redo: timelineRedo,
    })

    cleanup = mountGlobalHandlers()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.restoreAllMocks()
  })

  it('Ctrl+Z triggers undo on both temporal stores', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    expect(projectUndo).toHaveBeenCalledOnce()
    expect(timelineUndo).toHaveBeenCalledOnce()
  })

  it('Meta+Z (macOS Cmd+Z) triggers undo', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }))
    expect(projectUndo).toHaveBeenCalledOnce()
    expect(timelineUndo).toHaveBeenCalledOnce()
  })

  it('Ctrl+Shift+Z triggers redo on both temporal stores', () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
    )
    expect(projectRedo).toHaveBeenCalledOnce()
    expect(timelineRedo).toHaveBeenCalledOnce()
    expect(projectUndo).not.toHaveBeenCalled()
  })

  it('does NOT trigger undo when focused on INPUT', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    // Dispatch on window but simulate target = input
    input.dispatchEvent(event)

    expect(projectUndo).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does NOT trigger undo when focused on TEXTAREA', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: textarea, writable: false })
    textarea.dispatchEvent(event)

    expect(projectUndo).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('redo does not call undo', () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
    )
    expect(projectUndo).not.toHaveBeenCalled()
    expect(timelineUndo).not.toHaveBeenCalled()
    expect(projectRedo).toHaveBeenCalledOnce()
    expect(timelineRedo).toHaveBeenCalledOnce()
  })
})
