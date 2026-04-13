import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { playheadEmitter } from './PlayheadEmitter'
import { useTimelineStore } from '../stores/timeline-store'

// CSS class applied to active section elements
const ACTIVE_CLASS = 'section-active'

function clearHighlight(editorDom: HTMLElement): void {
  editorDom.querySelectorAll(`.${ACTIVE_CLASS}`).forEach((el) => {
    el.classList.remove(ACTIVE_CLASS)
  })
}

function applyHighlight(editorDom: HTMLElement, sectionOrder: number): void {
  clearHighlight(editorDom)
  const headings = editorDom.querySelectorAll('h2')
  const targetH2 = headings[sectionOrder]
  if (!targetH2) return

  targetH2.classList.add(ACTIVE_CLASS)
  // Highlight all sibling <p> elements until the next <h2>
  let sibling = targetH2.nextElementSibling
  while (sibling && sibling.tagName !== 'H2') {
    if (sibling.tagName === 'P') {
      sibling.classList.add(ACTIVE_CLASS)
    }
    sibling = sibling.nextElementSibling
  }

  // Auto-scroll to keep the section visible
  targetH2.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

/**
 * Hook that highlights the active script section in the Tiptap editor
 * during video playback, creating a teleprompter-like experience.
 */
export function usePlayheadHighlight(editor: Editor | null): void {
  const lastSectionOrderRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) return

    const editorDom = editor.view.dom

    const handlePosition = (position: number): void => {
      const { isPlaying, timeline } = useTimelineStore.getState()
      if (!isPlaying || !timeline) return

      // Find segment at current position
      const segment = timeline.tracks
        .filter((t) => t.type === 'clip' || t.type === 'recording')
        .flatMap((t) => t.segments)
        .find((s) => position >= s.startTime && position < s.endTime)

      if (!segment?.metadata) {
        if (lastSectionOrderRef.current !== null) {
          clearHighlight(editorDom)
          lastSectionOrderRef.current = null
        }
        return
      }

      try {
        const meta = JSON.parse(segment.metadata) as { sectionOrder?: number }
        if (meta.sectionOrder == null) return

        // Only update DOM when section changes
        if (meta.sectionOrder === lastSectionOrderRef.current) return
        lastSectionOrderRef.current = meta.sectionOrder
        applyHighlight(editorDom, meta.sectionOrder)
      } catch {
        // Invalid metadata — ignore
      }
    }

    // Subscribe to playhead position emitter
    playheadEmitter.on('position', handlePosition)

    // Subscribe to isPlaying to clear highlights when pausing
    const unsubscribe = useTimelineStore.subscribe((state, prevState) => {
      if (prevState.isPlaying && !state.isPlaying) {
        clearHighlight(editorDom)
        lastSectionOrderRef.current = null
      }
    })

    return () => {
      playheadEmitter.off('position', handlePosition)
      unsubscribe()
      clearHighlight(editorDom)
      lastSectionOrderRef.current = null
    }
  }, [editor])
}
