import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { playheadEmitter } from './PlayheadEmitter'
import { useTimelineStore } from '../stores/timeline-store'
import { useScriptStore } from '../stores/script-store'
import type { WordTiming } from '@shared/types/tts'

// CSS class applied to active section elements
const ACTIVE_CLASS = 'section-active'
const WORD_ACTIVE_CLASS = 'word-active'

// Throttle interval for word-level updates (ms)
const WORD_UPDATE_INTERVAL = 80

function clearHighlight(editorDom: HTMLElement): void {
  editorDom.querySelectorAll(`.${ACTIVE_CLASS}`).forEach((el) => {
    el.classList.remove(ACTIVE_CLASS)
  })
}

function clearWordHighlight(editorDom: HTMLElement): void {
  editorDom.querySelectorAll(`.${WORD_ACTIVE_CLASS}`).forEach((el) => {
    el.classList.remove(WORD_ACTIVE_CLASS)
  })
}

/**
 * Wrap each word in a section's <p> elements with <span> tags for word-level highlighting.
 * Stores original innerHTML in a data attribute for later restoration.
 */
function wrapWordsInSpans(pElements: NodeListOf<Element>): void {
  pElements.forEach((p) => {
    p.setAttribute('data-original-html', p.innerHTML)
    const text = p.textContent ?? ''
    const words = text.split(/(\s+)/) // Keep whitespace as separators
    let wordIdx = 0
    p.innerHTML = words
      .map((part) => {
        if (part.trim() === '') return part // Keep whitespace as-is
        return `<span class="word-span" data-word-idx="${wordIdx++}">${part}</span>`
      })
      .join('')
  })
}

/**
 * Restore original innerHTML for <p> elements that had word spans injected.
 */
function unwrapWords(pElements: NodeListOf<Element>): void {
  pElements.forEach((p) => {
    const original = p.getAttribute('data-original-html')
    if (original != null) {
      p.innerHTML = original
      p.removeAttribute('data-original-html')
    }
  })
}

/**
 * Get the <p> elements belonging to a section (between the section's <h2> and the next <h2>).
 */
function getSectionParagraphs(editorDom: HTMLElement, sectionOrder: number): NodeListOf<Element> {
  const headings = editorDom.querySelectorAll('h2')
  const targetH2 = headings[sectionOrder]
  const pElements: Element[] = []
  if (targetH2) {
    let sibling = targetH2.nextElementSibling
    while (sibling && sibling.tagName !== 'H2') {
      if (sibling.tagName === 'P') {
        pElements.push(sibling)
      }
      sibling = sibling.nextElementSibling
    }
  }
  // Return a NodeList-like structure by querying a temporary container trick,
  // but simpler: just return the array cast — callers iterate with forEach.
  // We'll use a different approach: return a real NodeList by using the elements directly.
  return pElements as unknown as NodeListOf<Element>
}

/**
 * Binary search (reverse linear scan) for the word at a given audio time.
 * Returns the index into wordTimings, or -1 if no word matches.
 */
function findWordAtTime(timings: WordTiming[], timeMs: number): number {
  for (let i = timings.length - 1; i >= 0; i--) {
    if (timeMs >= timings[i].offsetMs) return i
  }
  return -1
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
 * Also provides word-level highlighting when voiceover word timings are available.
 */
export function usePlayheadHighlight(editor: Editor | null): void {
  const lastSectionOrderRef = useRef<number | null>(null)
  const lastWordIdxRef = useRef<number>(-1)
  const lastWordUpdateTimeRef = useRef<number>(0)
  const currentSegmentStartRef = useRef<number>(0)
  const currentWordTimingsRef = useRef<WordTiming[]>([])
  const wrappedSectionRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) return

    const editorDom = editor.view.dom

    /**
     * Clean up word-level spans for the currently wrapped section.
     */
    const cleanupWordSpans = (): void => {
      if (wrappedSectionRef.current != null) {
        const pElements = getSectionParagraphs(editorDom, wrappedSectionRef.current)
        unwrapWords(pElements)
        wrappedSectionRef.current = null
      }
      clearWordHighlight(editorDom)
      lastWordIdxRef.current = -1
      currentWordTimingsRef.current = []
    }

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
          cleanupWordSpans()
          clearHighlight(editorDom)
          lastSectionOrderRef.current = null
        }
        return
      }

      try {
        const meta = JSON.parse(segment.metadata) as {
          sectionOrder?: number
          sectionId?: string
        }
        if (meta.sectionOrder == null) return

        // Section-level update: runs only when section changes
        if (meta.sectionOrder !== lastSectionOrderRef.current) {
          // Clean up previous section's word spans
          cleanupWordSpans()

          lastSectionOrderRef.current = meta.sectionOrder
          applyHighlight(editorDom, meta.sectionOrder)

          // Set up word-level highlighting for the new section
          currentSegmentStartRef.current = segment.startTime
          if (meta.sectionId) {
            const voiceovers = useScriptStore.getState().voiceovers
            const vo = voiceovers[meta.sectionId]
            const wordTimings = vo?.wordTimings ?? []
            currentWordTimingsRef.current = wordTimings

            if (wordTimings.length > 0) {
              const pElements = getSectionParagraphs(editorDom, meta.sectionOrder)
              wrapWordsInSpans(pElements)
              wrappedSectionRef.current = meta.sectionOrder
            }
          } else {
            currentWordTimingsRef.current = []
          }
        }

        // Word-level update: throttled to ~80ms
        if (currentWordTimingsRef.current.length === 0) return

        const now = performance.now()
        if (now - lastWordUpdateTimeRef.current < WORD_UPDATE_INTERVAL) return
        lastWordUpdateTimeRef.current = now

        const audioTimeMs = (position - currentSegmentStartRef.current) * 1000
        const wordIdx = findWordAtTime(currentWordTimingsRef.current, audioTimeMs)

        if (wordIdx !== lastWordIdxRef.current) {
          lastWordIdxRef.current = wordIdx

          // Remove previous word highlight
          const prev = editorDom.querySelector(`.${WORD_ACTIVE_CLASS}`)
          if (prev) prev.classList.remove(WORD_ACTIVE_CLASS)

          // Apply new word highlight
          if (wordIdx >= 0) {
            const current = editorDom.querySelector(`[data-word-idx="${wordIdx}"]`)
            if (current) {
              current.classList.add(WORD_ACTIVE_CLASS)
              current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
          }
        }
      } catch {
        // Invalid metadata — ignore
      }
    }

    // Subscribe to playhead position emitter
    playheadEmitter.on('position', handlePosition)

    // Subscribe to isPlaying to clear highlights when pausing
    const unsubscribe = useTimelineStore.subscribe((state, prevState) => {
      if (prevState.isPlaying && !state.isPlaying) {
        cleanupWordSpans()
        clearHighlight(editorDom)
        lastSectionOrderRef.current = null
      }
    })

    return () => {
      playheadEmitter.off('position', handlePosition)
      unsubscribe()
      cleanupWordSpans()
      clearHighlight(editorDom)
      lastSectionOrderRef.current = null
    }
  }, [editor])
}
