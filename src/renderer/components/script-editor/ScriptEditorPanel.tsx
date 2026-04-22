import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import type { ScriptSection } from '@shared/types/ai'
import { useScriptStore } from '../../stores/script-store'
import { useTimelineStore } from '../../stores/timeline-store'
import { usePlayheadHighlight } from '../../hooks/usePlayheadHighlight'
import { useToastStore } from '../../stores/toast-store'

/**
 * Convert an array of ScriptSection objects to Tiptap-compatible HTML.
 * Each section becomes: <h2>Section N</h2><p>text</p>
 * Returns a placeholder when sections is empty.
 */
export function sectionsToHtml(sections: ScriptSection[]): string {
  if (sections.length === 0) {
    return '<p>No script generated yet.</p>'
  }
  return sections
    .map((section, index) => `<h2>Section ${index + 1}</h2><p>${section.text}</p>`)
    .join('')
}

/**
 * Parse Tiptap HTML back into section descriptors.
 * Splits on <h2> boundaries — each h2 starts a new section.
 * All <p> text nodes between consecutive h2s belong to that section,
 * joined with '\n'.
 */
export function htmlToSections(html: string): { text: string; order: number }[] {
  // Use DOMParser when available (browser / jsdom), otherwise regex fallback
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body
    const results: { text: string; order: number }[] = []
    let current: string[] | null = null

    for (const node of Array.from(body.childNodes)) {
      const el = node as Element
      if (el.tagName === 'H2') {
        if (current !== null) {
          results.push({ text: current.join('\n'), order: results.length })
        }
        current = []
      } else if (current !== null) {
        const text = el.textContent?.trim() ?? ''
        if (text) {
          current.push(text)
        }
      }
    }

    // Flush the last section
    if (current !== null) {
      results.push({ text: current.join('\n'), order: results.length })
    }

    return results
  }

  // Regex fallback (Node.js environments without DOMParser)
  const sectionChunks = html.split(/<h2[^>]*>/i).slice(1)
  return sectionChunks.map((chunk, index) => {
    const stripped = chunk.replace(/<\/h2>/i, '')
    const paragraphs = [...stripped.matchAll(/<p[^>]*>(.*?)<\/p>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    )
    return { text: paragraphs.join('\n'), order: index }
  })
}

interface ScriptEditorPanelProps {
  /** Optional clip ID to scope the editor to a specific clip's script. */
  clipId?: string
}

export function ScriptEditorPanel({ clipId }: ScriptEditorPanelProps): React.ReactNode {
  const { sections, clipScripts, setSections, setClipScript, updateSection, removeClipScript } = useScriptStore()
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)
  const timeline = useTimelineStore((s) => s.timeline)
  const addToast = useToastStore((s) => s.addToast)

  const activeSections = clipId ? (clipScripts[clipId] ?? []) : sections
  const isSyncingRef = useRef(false)

  const handleClearScript = async () => {
    const activeClipId = clipId ?? Object.keys(clipScripts)[0]
    if (activeClipId && window.leonardo?.script?.delete) {
      try {
        await window.leonardo.script.delete(activeClipId)
      } catch (err) {
        console.error('[ScriptEditor] Failed to delete script from DB:', err)
      }
    }
    if (activeClipId) {
      removeClipScript(activeClipId)
    }
    setSections([])
    addToast('Script cleared', 'info')
  }

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2] } })],
    content: sectionsToHtml(activeSections),
    onUpdate: ({ editor: ed }) => {
      if (isSyncingRef.current) return
      const html = ed.getHTML()
      const parsed = htmlToSections(html)

      // Map parsed results back to ScriptSection[], preserving existing IDs by order
      const updatedSections: ScriptSection[] = parsed.map((parsed) => {
        const existing = activeSections[parsed.order]
        if (existing) {
          // Use updateSection to properly mark voiceover stale when text changes
          if (existing.text !== parsed.text) {
            updateSection(existing.id, { text: parsed.text })
          }
          return { ...existing, text: parsed.text, order: parsed.order }
        }
        // New section inserted by user
        return {
          id: crypto.randomUUID(),
          scriptId: activeSections[0]?.scriptId ?? '',
          text: parsed.text,
          voiceProfileId: null,
          startTime: 0,
          endTime: 0,
          timingMarkers: [],
          order: parsed.order,
        }
      })

      if (clipId) {
        setClipScript(clipId, updatedSections)
      } else {
        setSections(updatedSections)
      }
    },
  })

  usePlayheadHighlight(editor)

  // Sync store changes into the editor (e.g., after AI generation)
  useEffect(() => {
    if (!editor) return
    const html = sectionsToHtml(activeSections)
    if (html !== editor.getHTML()) {
      isSyncingRef.current = true
      editor.commands.setContent(html, { emitUpdate: false })
      isSyncingRef.current = false
    }
  }, [activeSections, editor])

  // When a segment is selected in timeline, scroll to the corresponding section header
  useEffect(() => {
    if (!editor || !selectedSegmentId || !timeline) return

    // Find the selected segment
    const segment = timeline.tracks
      .flatMap((t) => t.segments)
      .find((s) => s.id === selectedSegmentId)
    if (!segment?.metadata) return

    try {
      const meta = JSON.parse(segment.metadata) as { sectionId?: string; sectionOrder?: number }
      if (meta.sectionOrder == null) return

      // Scroll to the Nth h2 heading in the editor
      const editorEl = editor.view.dom
      const headings = editorEl.querySelectorAll('h2')
      const targetHeading = headings[meta.sectionOrder]
      if (targetHeading) {
        targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } catch {
      // Invalid metadata — ignore
    }
  }, [selectedSegmentId, timeline, editor])

  return (
    <div className="script-editor-panel">
      <div className="script-editor-panel-header">
        <span>Script Editor</span>
        {activeSections.length > 0 && (
          <button
            className="rec-btn"
            style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px' }}
            onClick={handleClearScript}
          >
            Clear
          </button>
        )}
      </div>
      <div className="tiptap-editor-wrapper">
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>
    </div>
  )
}
