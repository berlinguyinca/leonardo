# Script View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Script workspace into a two-panel layout with Tiptap editor on the left, video preview + compact timeline on the right, fix TTS audio generation, and add a post-generation AI prompt log.

**Architecture:** PanelSystem renders a new two-column layout for the `script` preset: `ScriptEditorPanel` (left, Tiptap with `## Section N` delimiters synced to script-store) and a refactored `ScriptTimelineView` (right, video + toolbar + compact timeline). Timeline hides ScriptTextTrack when in script preset. AI IPC returns prompt metadata for a `GenerationLog` component.

**Tech Stack:** React, Zustand, Tiptap v3 (@tiptap/react, @tiptap/starter-kit), edge-tts, Electron IPC

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/renderer/components/script-editor/ScriptEditorPanel.tsx` | Tiptap wrapper: section header parsing, bidirectional sync with script-store |
| Create | `src/renderer/components/script-editor/GenerationLog.tsx` | Post-generation collapsible log + regenerate button |
| Modify | `src/renderer/components/layout/PanelSystem.tsx:76-91` | Script preset → two-column layout with resizable divider |
| Modify | `src/renderer/components/script-editor/ScriptTimelineView.tsx` | Strip to right-panel content only (video + toolbar + compact timeline) |
| Modify | `src/renderer/components/timeline/Timeline.tsx:250` | Hide ScriptTextTrack when preset=script |
| Modify | `src/renderer/stores/script-store.ts` | Add `generationLog` state for prompt/response metadata |
| Modify | `src/main/ipc/ai.ipc.ts:11-41` | Return systemPrompt + userMessage alongside script result |
| Modify | `src/main/services/tts/edge-tts-provider.ts:16-36` | Fix synthesize: add error handling + buffer validation |
| Modify | `src/preload/index.ts` | Update AI bridge to pass through prompt metadata |
| Modify | `src/renderer/styles/globals.css` | Script panel layout, generation log, compact timeline styles |
| Test | `tests/unit/script-editor-panel.test.tsx` | Section parsing, sync, merge/split |
| Test | `tests/unit/generation-log.test.tsx` | Log rendering, regenerate |
| Test | `tests/unit/edge-tts-provider.test.ts` | Synthesize produces non-empty buffer |
| Test | `tests/integration/script-view-layout.test.tsx` | Two-panel layout, compact timeline |

---

### Task 1: Fix Edge-TTS Audio Generation

**Files:**
- Modify: `src/main/services/tts/edge-tts-provider.ts:16-36`
- Test: `tests/unit/edge-tts-provider.test.ts`

- [ ] **Step 1: Write the failing test for TTS synthesize producing a file**

```typescript
// tests/unit/edge-tts-provider.test.ts
// Add this test case to the existing describe block:

it('synthesize writes a non-empty audio file to disk', async () => {
  const provider = new EdgeTTSProvider()
  const voice: VoiceProfile = {
    id: 'test-voice',
    name: 'Test',
    provider: 'edge-tts',
    voiceId: 'en-US-AriaNeural',
    samples: [],
    isDefault: true,
  }

  const result = await provider.synthesize('Hello world, this is a test.', voice)

  expect(result.filePath).toBeTruthy()
  expect(result.duration).toBeGreaterThan(0)
  // Verify file exists and has content
  const { statSync } = await import('fs')
  const stat = statSync(result.filePath)
  expect(stat.size).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `npm test -- --testPathPattern edge-tts-provider`
Expected: test may fail if audio buffer is empty or WebSocket fails

- [ ] **Step 3: Fix edge-tts-provider.ts with proper error handling and buffer validation**

Replace the `synthesize` method body in `src/main/services/tts/edge-tts-provider.ts` (lines 16-36):

```typescript
async synthesize(text: string, voice: VoiceProfile): Promise<TTSSynthesisResult> {
  const hash = computeSectionHash(text, voice.voiceId, 'edge-tts')
  const cached = getCachedResult(hash)
  if (cached) return cached

  const outputPath = join(tmpdir(), `leonardo-tts-${Date.now()}-${voice.voiceId}.mp3`)

  let audioBuffer: Buffer
  try {
    audioBuffer = await edgeTTS(text, { voice: voice.voiceId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Edge TTS synthesis failed: ${msg}`)
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Edge TTS returned empty audio buffer')
  }

  writeFileSync(outputPath, audioBuffer)
  console.log(`[TTS] Wrote ${audioBuffer.length} bytes to ${outputPath}`)

  // Estimate duration from text (150 words per minute)
  const wordCount = text.split(/\s+/).length
  const estimatedDuration = (wordCount / 150) * 60 * 1000

  const result: TTSSynthesisResult = {
    filePath: outputPath,
    duration: estimatedDuration,
    sectionId: '',
  }
  setCachedResult(hash, result)
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern edge-tts-provider`
Expected: PASS — file written with non-zero size

- [ ] **Step 5: Commit**

```bash
git add src/main/services/tts/edge-tts-provider.ts tests/unit/edge-tts-provider.test.ts
git commit -m "fix: edge-tts synthesize with error handling and buffer validation"
```

---

### Task 2: AI IPC Returns Prompt Metadata

**Files:**
- Modify: `src/main/ipc/ai.ipc.ts:11-41`
- Modify: `src/main/services/ai/claude-provider.ts:24-49`
- Modify: `src/shared/types/ai.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/stores/script-store.ts`
- Test: `tests/unit/ai-ipc-prompt-metadata.test.ts`

- [ ] **Step 1: Add GenerationLog type to shared types**

Add at the end of `src/shared/types/ai.ts`:

```typescript
export interface GenerationLog {
  systemPrompt: string
  userMessage: string
  rawResponse: string
  timestamp: string
  provider: AIProviderType
}
```

- [ ] **Step 2: Write failing test for AI IPC returning prompt metadata**

Create `tests/unit/ai-ipc-prompt-metadata.test.ts`:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { getSystemPrompt, buildScriptPrompt } from '../../src/main/services/ai/prompt-templates'

describe('AI prompt metadata', () => {
  it('getSystemPrompt returns non-empty string', () => {
    const prompt = getSystemPrompt()
    expect(prompt.length).toBeGreaterThan(100)
    expect(prompt).toContain('scriptwriter')
  })

  it('buildScriptPrompt includes all context fields', () => {
    const prompt = buildScriptPrompt({
      domEvents: [],
      recordingDuration: 30000,
      url: 'https://example.com',
      userPrompt: 'Test prompt',
    })
    expect(prompt).toContain('https://example.com')
    expect(prompt).toContain('30.0 seconds')
    expect(prompt).toContain('Test prompt')
  })
})
```

- [ ] **Step 3: Run test to verify it passes (these test existing code)**

Run: `npm test -- --testPathPattern ai-ipc-prompt-metadata`
Expected: PASS

- [ ] **Step 4: Modify AI IPC to return prompt metadata alongside script**

In `src/main/ipc/ai.ipc.ts`, update the `AI_GENERATE_SCRIPT` handler return type and logic. Replace lines 22-31:

```typescript
    ): Promise<{ success: boolean; script?: Script; error?: string; generationLog?: GenerationLog }> => {
      try {
        assertTrustedIPCEvent(event)
        console.log(`[AI] Generating script: provider=${args.config.provider} model=${args.config.model ?? 'default'} prompt="${args.prompt.slice(0, 100)}..."`)
        const provider = createAIProvider(args.config)

        // Build the prompt metadata for the generation log
        const { getSystemPrompt, buildScriptPrompt } = await import('../services/ai/prompt-templates')
        const systemPrompt = getSystemPrompt()
        const userMessage = `${args.prompt}\n\n${buildScriptPrompt(args.context)}`

        const script = await provider.generateScript(args.prompt, args.context)
        script.projectId = args.projectId
        const saved = saveScript(script, args.clipId)
        console.log(`[AI] Script generated: ${saved.sections.length} sections`)

        const generationLog: GenerationLog = {
          systemPrompt,
          userMessage,
          rawResponse: saved.sections.map((s, i) => `${i + 1}. ${s.text}`).join('\n\n'),
          timestamp: new Date().toISOString(),
          provider: args.config.provider,
        }

        return { success: true, script: saved, generationLog }
      } catch (err) {
```

Add the import at the top of `src/main/ipc/ai.ipc.ts`:

```typescript
import type { GenerationLog } from '@shared/types/ai'
```

- [ ] **Step 5: Update preload bridge to pass through generationLog**

In `src/preload/index.ts`, the `generateScript` function already returns the full IPC result object. Since the result now includes `generationLog`, no code change is needed — the field passes through automatically via `ipcRenderer.invoke`. Verify this by checking the preload code.

- [ ] **Step 6: Add generationLog to script-store**

In `src/renderer/stores/script-store.ts`, add to the state interface and actions:

Add state field:
```typescript
generationLog: GenerationLog | null
```

Add action:
```typescript
setGenerationLog: (log: GenerationLog | null) => void
```

In the store creation, add:
```typescript
generationLog: null,
setGenerationLog: (log) => set({ generationLog: log }),
```

Import `GenerationLog` from `@shared/types/ai`.

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/shared/types/ai.ts src/main/ipc/ai.ipc.ts src/renderer/stores/script-store.ts tests/unit/ai-ipc-prompt-metadata.test.ts
git commit -m "feat: AI IPC returns prompt metadata for generation log"
```

---

### Task 3: ScriptEditorPanel — Tiptap with Section Headers

**Files:**
- Create: `src/renderer/components/script-editor/ScriptEditorPanel.tsx`
- Test: `tests/unit/script-editor-panel.test.tsx`

- [ ] **Step 1: Write failing test for ScriptEditorPanel section parsing**

Create `tests/unit/script-editor-panel.test.tsx`:

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the pure parsing functions first (extract them as exports)
import {
  sectionsToHtml,
  htmlToSections,
} from '../../src/renderer/components/script-editor/ScriptEditorPanel'

describe('ScriptEditorPanel — section parsing', () => {
  it('sectionsToHtml converts sections to heading + paragraph HTML', () => {
    const sections = [
      { id: 's1', scriptId: 'sc1', text: 'Welcome to this tutorial.', voiceProfileId: null, startTime: 0, endTime: 5000, timingMarkers: [], order: 0 },
      { id: 's2', scriptId: 'sc1', text: 'Click the settings icon.', voiceProfileId: null, startTime: 5000, endTime: 10000, timingMarkers: [], order: 1 },
    ]
    const html = sectionsToHtml(sections)
    expect(html).toContain('<h2>Section 1</h2>')
    expect(html).toContain('<p>Welcome to this tutorial.</p>')
    expect(html).toContain('<h2>Section 2</h2>')
    expect(html).toContain('<p>Click the settings icon.</p>')
  })

  it('htmlToSections parses heading-delimited HTML back to sections', () => {
    const html = '<h2>Section 1</h2><p>First section text.</p><h2>Section 2</h2><p>Second section text.</p>'
    const sections = htmlToSections(html)
    expect(sections).toHaveLength(2)
    expect(sections[0].text).toBe('First section text.')
    expect(sections[0].order).toBe(0)
    expect(sections[1].text).toBe('Second section text.')
    expect(sections[1].order).toBe(1)
  })

  it('htmlToSections handles merged sections (header deleted)', () => {
    // Only one header, all text below it = one section
    const html = '<h2>Section 1</h2><p>First paragraph.</p><p>Second paragraph merged in.</p>'
    const sections = htmlToSections(html)
    expect(sections).toHaveLength(1)
    expect(sections[0].text).toContain('First paragraph.')
    expect(sections[0].text).toContain('Second paragraph merged in.')
  })

  it('htmlToSections handles new header insertion (split)', () => {
    const html = '<h2>Section 1</h2><p>Before split.</p><h2>Section 2</h2><p>After split.</p><h2>Section 3</h2><p>Third section.</p>'
    const sections = htmlToSections(html)
    expect(sections).toHaveLength(3)
    expect(sections[0].text).toBe('Before split.')
    expect(sections[1].text).toBe('After split.')
    expect(sections[2].text).toBe('Third section.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern script-editor-panel`
Expected: FAIL — module not found

- [ ] **Step 3: Create ScriptEditorPanel with exported parsing functions**

Create `src/renderer/components/script-editor/ScriptEditorPanel.tsx`:

```typescript
import { useCallback, useRef, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useScriptStore } from '../../stores/script-store'
import { useUIStore } from '../../stores/ui-store'
import type { ScriptSection } from '@shared/types/ai'

/**
 * Convert ScriptSection[] → Tiptap HTML with ## Section N headers.
 */
export function sectionsToHtml(sections: ScriptSection[]): string {
  if (sections.length === 0) return '<p>No script generated yet. Click "Generate Script" to start.</p>'
  return sections
    .sort((a, b) => a.order - b.order)
    .map((s, i) => {
      const paragraphs = s.text
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => `<p>${line}</p>`)
        .join('')
      return `<h2>Section ${i + 1}</h2>${paragraphs || '<p></p>'}`
    })
    .join('')
}

/**
 * Parse Tiptap HTML back into section data.
 * Each <h2> starts a new section. All content until the next <h2> is that section's text.
 */
export function htmlToSections(html: string): { text: string; order: number }[] {
  const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null
  if (!parser) return []

  const doc = parser.parseFromString(html, 'text/html')
  const nodes = Array.from(doc.body.childNodes)

  const sections: { text: string; order: number }[] = []
  let currentTexts: string[] = []
  let sectionCount = 0

  for (const node of nodes) {
    const el = node as HTMLElement
    if (el.tagName === 'H2') {
      // Save previous section if it has content
      if (currentTexts.length > 0 && sectionCount > 0) {
        sections.push({ text: currentTexts.join('\n'), order: sectionCount - 1 })
      }
      currentTexts = []
      sectionCount++
    } else {
      const text = (el.textContent ?? '').trim()
      if (text) currentTexts.push(text)
    }
  }

  // Push last section
  if (currentTexts.length > 0 && sectionCount > 0) {
    sections.push({ text: currentTexts.join('\n'), order: sectionCount - 1 })
  }

  return sections
}

interface ScriptEditorPanelProps {
  onScrollToSection?: (sectionId: string) => void
}

export function ScriptEditorPanel({ onScrollToSection }: ScriptEditorPanelProps): React.ReactNode {
  const sections = useScriptStore((s) => s.sections)
  const clipScripts = useScriptStore((s) => s.clipScripts)
  const setSections = useScriptStore((s) => s.setSections)
  const setClipScript = useScriptStore((s) => s.setClipScript)
  const preset = useUIStore((s) => s.workspacePreset)

  // Track whether we're syncing from store → editor to avoid loops
  const isSyncingRef = useRef(false)
  const lastHtmlRef = useRef('')

  // Get the active clip's sections (first clip with scripts)
  const activeClipId = Object.keys(clipScripts)[0] ?? null
  const activeSections = activeClipId ? clipScripts[activeClipId] : sections

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
    ],
    content: sectionsToHtml(activeSections),
    editable: true,
    onUpdate: ({ editor: ed }) => {
      if (isSyncingRef.current) return
      const html = ed.getHTML()
      if (html === lastHtmlRef.current) return
      lastHtmlRef.current = html

      // Parse sections from editor content
      const parsed = htmlToSections(html)
      if (parsed.length === 0) return

      // Map parsed sections back to existing section IDs (by order), creating new IDs for splits
      const updatedSections: ScriptSection[] = parsed.map((p, i) => {
        const existing = activeSections[i]
        return {
          id: existing?.id ?? crypto.randomUUID(),
          scriptId: existing?.scriptId ?? activeSections[0]?.scriptId ?? '',
          text: p.text,
          voiceProfileId: existing?.voiceProfileId ?? null,
          startTime: existing?.startTime ?? 0,
          endTime: existing?.endTime ?? 0,
          timingMarkers: existing?.timingMarkers ?? [],
          order: p.order,
        }
      })

      setSections(updatedSections)
      if (activeClipId) {
        setClipScript(activeClipId, updatedSections)
      }
    },
  })

  // Sync store → editor when sections change externally (e.g., AI generation)
  useEffect(() => {
    if (!editor) return
    const newHtml = sectionsToHtml(activeSections)
    if (newHtml === lastHtmlRef.current) return

    isSyncingRef.current = true
    lastHtmlRef.current = newHtml
    editor.commands.setContent(newHtml, { emitUpdate: false })
    isSyncingRef.current = false
  }, [activeSections, editor])

  // Expose scroll-to-section: find the Nth h2 and scroll it into view
  useEffect(() => {
    if (!onScrollToSection || !editor) return
    // This is called externally — see PanelSystem wiring
  }, [onScrollToSection, editor])

  if (preset !== 'script') return null

  return (
    <div className="script-editor-panel">
      <div className="script-editor-panel-header">Script Editor</div>
      <div className="tiptap-editor-wrapper">
        <EditorContent editor={editor} className="tiptap-editor" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern script-editor-panel`
Expected: PASS — all 4 parsing tests green

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/script-editor/ScriptEditorPanel.tsx tests/unit/script-editor-panel.test.tsx
git commit -m "feat: ScriptEditorPanel with Tiptap section header parsing"
```

---

### Task 4: GenerationLog Component

**Files:**
- Create: `src/renderer/components/script-editor/GenerationLog.tsx`
- Test: `tests/unit/generation-log.test.tsx`

- [ ] **Step 1: Write failing test for GenerationLog rendering**

Create `tests/unit/generation-log.test.tsx`:

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GenerationLog } from '../../src/renderer/components/script-editor/GenerationLog'
import type { GenerationLog as GenerationLogType } from '@shared/types/ai'

const mockLog: GenerationLogType = {
  systemPrompt: 'You are a video tutorial scriptwriter.',
  userMessage: 'Generate a tutorial.\n\nRecording details:\n- URL: https://example.com\n- Duration: 30.0 seconds',
  rawResponse: '1. Welcome to this tutorial.\n\n2. Click the settings icon.',
  timestamp: '2026-04-13T10:00:00Z',
  provider: 'claude',
}

describe('GenerationLog', () => {
  it('renders nothing when log is null', () => {
    const { container } = render(<GenerationLog log={null} onRegenerate={() => {}} />)
    expect(container.querySelector('.generation-log')).toBeNull()
  })

  it('renders collapsible sections when log exists', () => {
    render(<GenerationLog log={mockLog} onRegenerate={() => {}} />)
    expect(screen.getByText('System Prompt')).toBeInTheDocument()
    expect(screen.getByText('User Message')).toBeInTheDocument()
    expect(screen.getByText('AI Response')).toBeInTheDocument()
  })

  it('expands a section on click', () => {
    render(<GenerationLog log={mockLog} onRegenerate={() => {}} />)
    const userMsgHeader = screen.getByText('User Message')
    fireEvent.click(userMsgHeader)
    expect(screen.getByText(/https:\/\/example\.com/)).toBeInTheDocument()
  })

  it('calls onRegenerate with custom prompt text', () => {
    const onRegenerate = vi.fn()
    render(<GenerationLog log={mockLog} onRegenerate={onRegenerate} />)
    const btn = screen.getByText('Regenerate with Custom Prompt')
    fireEvent.click(btn)
    // Should show a textarea
    const textarea = document.querySelector('.generation-log-prompt-input') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern generation-log`
Expected: FAIL — module not found

- [ ] **Step 3: Create GenerationLog component**

Create `src/renderer/components/script-editor/GenerationLog.tsx`:

```typescript
import { useState } from 'react'
import type { GenerationLog as GenerationLogType } from '@shared/types/ai'

interface GenerationLogProps {
  log: GenerationLogType | null
  onRegenerate: (customPrompt: string) => void
}

export function GenerationLog({ log, onRegenerate }: GenerationLogProps): React.ReactNode {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

  if (!log) return null

  function toggleSection(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const sections: { key: string; label: string; content: string }[] = [
    { key: 'system', label: 'System Prompt', content: log.systemPrompt },
    { key: 'user', label: 'User Message', content: log.userMessage },
    { key: 'response', label: 'AI Response', content: log.rawResponse },
  ]

  return (
    <div className="generation-log">
      <div className="generation-log-header">
        Generation Log
        <span className="generation-log-meta">
          {log.provider} &middot; {new Date(log.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {sections.map((s) => (
        <div key={s.key} className="generation-log-section">
          <div
            className="generation-log-section-header"
            onClick={() => toggleSection(s.key)}
          >
            <span>{expanded[s.key] ? '\u25BC' : '\u25B6'}</span>
            <span>{s.label}</span>
          </div>
          {expanded[s.key] && (
            <pre className="generation-log-section-content">{s.content}</pre>
          )}
        </div>
      ))}
      {!showPromptInput ? (
        <button
          className="generation-log-regenerate-btn"
          onClick={() => {
            setShowPromptInput(true)
            setCustomPrompt('')
          }}
        >
          Regenerate with Custom Prompt
        </button>
      ) : (
        <div className="generation-log-prompt-form">
          <textarea
            className="generation-log-prompt-input"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter your custom prompt..."
            rows={3}
            autoFocus
          />
          <div className="generation-log-prompt-actions">
            <button
              className="rec-btn"
              onClick={() => {
                if (customPrompt.trim()) {
                  onRegenerate(customPrompt.trim())
                  setShowPromptInput(false)
                }
              }}
              disabled={!customPrompt.trim()}
            >
              Generate
            </button>
            <button
              className="rec-btn"
              onClick={() => setShowPromptInput(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern generation-log`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/script-editor/GenerationLog.tsx tests/unit/generation-log.test.tsx
git commit -m "feat: GenerationLog component with collapsible prompt sections"
```

---

### Task 5: Compact Timeline — Hide ScriptTextTrack in Script View

**Files:**
- Modify: `src/renderer/components/timeline/Timeline.tsx:250`
- Test: `tests/unit/compact-timeline.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/unit/compact-timeline.test.tsx`:

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Timeline } from '../../src/renderer/components/timeline/Timeline'

const mockTimeline = {
  id: 'tl-1',
  projectId: 'p1',
  tracks: [
    { id: 't1', type: 'clip' as const, label: 'Video', segments: [], muted: false, locked: false },
  ],
  syncPoints: [],
  duration: 10000,
}

vi.mock('../../src/renderer/stores/timeline-store', () => ({
  useTimelineStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      timeline: mockTimeline,
      playheadPosition: 0,
      isPlaying: false,
      selectedSegmentId: null,
      setPlayheadPosition: vi.fn(),
      setSelectedSegment: vi.fn(),
      removeSegment: vi.fn(),
      playbackRate: 1,
      togglePlayback: vi.fn(),
    }),
}))
vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ clips: [] }),
}))
vi.mock('../../src/renderer/stores/ui-store', () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ workspacePreset: 'script' }),
}))
vi.mock('../../src/renderer/hooks/usePlayhead', () => ({
  usePlayhead: () => {},
}))
vi.mock('../../src/renderer/hooks/useTimelineZoom', () => ({
  useTimelineZoom: () => ({ zoomLevel: 1, setZoomLevel: vi.fn() }),
}))
vi.mock('../../src/renderer/hooks/PlayheadEmitter', () => ({
  playheadEmitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}))

describe('Timeline compact mode (script preset)', () => {
  it('does not render ScriptTextTrack when preset is script', () => {
    const { container } = render(<Timeline />)
    expect(container.querySelector('.script-text-track')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern compact-timeline`
Expected: FAIL — ScriptTextTrack is still rendered

- [ ] **Step 3: Conditionally hide ScriptTextTrack in Timeline.tsx**

In `src/renderer/components/timeline/Timeline.tsx`, add the ui-store import at the top:

```typescript
import { useUIStore } from '../../stores/ui-store'
```

Inside the `Timeline` component function, add:

```typescript
const workspacePreset = useUIStore((s) => s.workspacePreset)
```

Replace line 250 (`<ScriptTextTrack zoomLevel={zoomLevel} scrollLeft={scrollOffset} />`):

```typescript
{workspacePreset !== 'script' && (
  <ScriptTextTrack zoomLevel={zoomLevel} scrollLeft={scrollOffset} />
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --testPathPattern compact-timeline`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all pass (no regressions in other timeline tests)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/timeline/Timeline.tsx tests/unit/compact-timeline.test.tsx
git commit -m "feat: hide ScriptTextTrack in script preset for compact timeline"
```

---

### Task 6: PanelSystem Script Layout + ScriptTimelineView Refactor

**Files:**
- Modify: `src/renderer/components/layout/PanelSystem.tsx:76-91`
- Modify: `src/renderer/components/script-editor/ScriptTimelineView.tsx`
- Modify: `src/renderer/styles/globals.css`
- Test: `tests/integration/script-view-layout.test.tsx`

- [ ] **Step 1: Write failing test for two-panel layout**

Create `tests/integration/script-view-layout.test.tsx`:

```typescript
// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Minimal mocks to render PanelSystem in script preset
vi.mock('../../src/renderer/stores/ui-store', () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      workspacePreset: 'script',
      editorView: 'inline',
      sidebarWidth: 260,
      timelineHeight: 300,
      sidebarCollapsed: false,
      propertiesCollapsed: false,
      timelineCollapsed: false,
      setSidebarWidth: vi.fn(),
      setTimelineHeight: vi.fn(),
      setEditorView: vi.fn(),
      setWorkspacePreset: vi.fn(),
      followPlayhead: false,
    }),
}))
vi.mock('../../src/renderer/stores/timeline-store', () => ({
  useTimelineStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      timeline: null,
      playheadPosition: 0,
      isPlaying: false,
      selectedSegmentId: null,
      setPlayheadPosition: vi.fn(),
      setSelectedSegment: vi.fn(),
      removeSegment: vi.fn(),
      playbackRate: 1,
      togglePlayback: vi.fn(),
    }),
}))
vi.mock('../../src/renderer/stores/library-store', () => ({
  useLibraryStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ clips: [] }),
}))
vi.mock('../../src/renderer/stores/script-store', () => ({
  useScriptStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      sections: [],
      clipScripts: {},
      voiceovers: {},
      generationLog: null,
      setSections: vi.fn(),
      setClipScript: vi.fn(),
      setGenerationLog: vi.fn(),
      setVoiceover: vi.fn(),
    }),
}))
vi.mock('../../src/renderer/stores/project-store', () => ({
  useProjectStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ activeProjectId: 'proj-1' }),
}))
vi.mock('../../src/renderer/hooks/usePlayhead', () => ({ usePlayhead: () => {} }))
vi.mock('../../src/renderer/hooks/useTimelineZoom', () => ({
  useTimelineZoom: () => ({ zoomLevel: 1, setZoomLevel: vi.fn() }),
}))
vi.mock('../../src/renderer/hooks/PlayheadEmitter', () => ({
  playheadEmitter: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}))

// Lazy import after mocks
const { PanelSystem } = await import('../../src/renderer/components/layout/PanelSystem')

describe('Script view layout', () => {
  it('renders two-panel layout: editor left, video+timeline right', () => {
    const { container } = render(<PanelSystem preset="script" />)
    expect(container.querySelector('.script-editor-panel')).toBeInTheDocument()
    expect(container.querySelector('.script-right-panel')).toBeInTheDocument()
    expect(container.querySelector('.script-split-divider')).toBeInTheDocument()
  })

  it('renders compact timeline (no ScriptTextTrack)', () => {
    const { container } = render(<PanelSystem preset="script" />)
    expect(container.querySelector('.script-text-track')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern script-view-layout`
Expected: FAIL — no `.script-editor-panel` or `.script-right-panel`

- [ ] **Step 3: Update PanelSystem script preset layout**

In `src/renderer/components/layout/PanelSystem.tsx`, replace the script preset block (lines 76-91):

Add imports at top:
```typescript
import { ScriptEditorPanel } from '../script-editor/ScriptEditorPanel'
import { GenerationLog } from '../script-editor/GenerationLog'
```

Replace the script preset return:

```typescript
if (preset === 'script') {
  return (
    <div className="panel-system script-layout">
      {/* Left: Script Editor + Generation Log */}
      <div className="script-editor-panel" style={{ width: `${sidebarWidth}px` }}>
        <ScriptEditorPanel />
        <GenerationLog
          log={null} // wired in ScriptTimelineView via store
          onRegenerate={() => {}} // wired in ScriptTimelineView
        />
      </div>

      {/* Resizable divider */}
      <div
        className="resize-handle resize-handle-v script-split-divider"
        onMouseDown={handleMouseDown('sidebar')}
      />

      {/* Right: Video + Toolbar + Compact Timeline */}
      <div className="script-right-panel" style={{ flex: 1 }}>
        <ScriptTimelineView />
      </div>
    </div>
  )
}
```

**Wait** — this approach has a problem: GenerationLog needs access to the generation state and the regenerate handler, which live in ScriptTimelineView. Better approach: put GenerationLog inside ScriptTimelineView's right panel (below the toolbar), and keep ScriptEditorPanel as a standalone left panel. The store holds the generationLog state.

Revised PanelSystem script block:

```typescript
if (preset === 'script') {
  return (
    <div className="panel-system script-layout">
      {/* Left: Script Editor */}
      <div className="script-left-panel" style={{ width: `${sidebarWidth}px`, minWidth: 250 }}>
        <ScriptEditorPanel />
      </div>

      {/* Resizable divider */}
      <div
        className="resize-handle resize-handle-v script-split-divider"
        onMouseDown={handleMouseDown('sidebar')}
      />

      {/* Right: Video + Toolbar + Generation Log + Compact Timeline */}
      <div className="script-right-panel" style={{ flex: 1 }}>
        <ScriptTimelineView />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Refactor ScriptTimelineView to right-panel content**

In `src/renderer/components/script-editor/ScriptTimelineView.tsx`:

1. Add GenerationLog import and wiring
2. Store generation log in script-store after AI call
3. Make timeline section use fixed compact height
4. Add GenerationLog between toolbar and timeline

Replace the `handleGenerateScript` function to store the log:

```typescript
const setGenerationLog = useScriptStore((s) => s.setGenerationLog)
const generationLog = useScriptStore((s) => s.generationLog)

const handleGenerateScript = async () => {
  if (!activeProjectId || !window.leonardo?.ai) return
  setGenerating(true)
  try {
    const timeline = useTimelineStore.getState().timeline
    const clips = useLibraryStore.getState().clips
    if (!timeline) return

    const firstClipSegment = timeline.tracks
      .filter((t) => t.type === 'clip' || t.type === 'recording')
      .flatMap((t) => t.segments)[0]
    if (!firstClipSegment) return

    const clip = clips.find((c) => c.filePath === firstClipSegment.sourceFile)
    if (!clip) return

    const result = await window.leonardo.ai.generateScript({
      config: { provider: 'claude', mode: 'cloud' },
      prompt: 'Generate a tutorial narration script for this recording.',
      context: {
        domEvents: [],
        recordingDuration: clip.duration,
        url: clip.url,
        userPrompt: 'Generate a tutorial narration script for this recording.',
      },
      projectId: activeProjectId,
      clipId: clip.id,
    })

    if (result.success && result.script && result.script.sections.length > 0) {
      useScriptStore.getState().setSections(result.script.sections)
      useScriptStore.getState().setClipScript(clip.id, result.script.sections)

      if (result.script.sections.length > 1) {
        useTimelineStore.getState().splitClipBySections(firstClipSegment.id, result.script.sections)
      }
    }

    // Store generation log if returned
    if (result.generationLog) {
      setGenerationLog(result.generationLog)
    }
  } catch (err) {
    console.error('[ScriptTimelineView] Script generation failed:', err)
  } finally {
    setGenerating(false)
  }
}
```

Add a `handleRegenerate` function:

```typescript
const handleRegenerate = async (customPrompt: string) => {
  if (!activeProjectId || !window.leonardo?.ai) return
  setGenerating(true)
  try {
    const timeline = useTimelineStore.getState().timeline
    const clips = useLibraryStore.getState().clips
    if (!timeline) return

    const firstClipSegment = timeline.tracks
      .filter((t) => t.type === 'clip' || t.type === 'recording')
      .flatMap((t) => t.segments)[0]
    if (!firstClipSegment) return

    const clip = clips.find((c) => c.filePath === firstClipSegment.sourceFile)
    if (!clip) return

    const result = await window.leonardo.ai.generateScript({
      config: { provider: 'claude', mode: 'cloud' },
      prompt: customPrompt,
      context: {
        domEvents: [],
        recordingDuration: clip.duration,
        url: clip.url,
        userPrompt: customPrompt,
      },
      projectId: activeProjectId,
      clipId: clip.id,
    })

    if (result.success && result.script && result.script.sections.length > 0) {
      useScriptStore.getState().setSections(result.script.sections)
      useScriptStore.getState().setClipScript(clip.id, result.script.sections)
    }
    if (result.generationLog) {
      setGenerationLog(result.generationLog)
    }
  } catch (err) {
    console.error('[ScriptTimelineView] Regeneration failed:', err)
  } finally {
    setGenerating(false)
  }
}
```

Add GenerationLog import:
```typescript
import { GenerationLog } from './GenerationLog'
```

Update the render return — replace the full return block:

```typescript
return (
  <div
    ref={containerRef}
    className="script-timeline-view"
    style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}
  >
    {/* Top: Video Preview */}
    <div className="script-preview-section" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <PlaybackPanel />
    </div>

    {/* Resize Divider */}
    <div
      className="script-resize-divider"
      onMouseDown={handleMouseDown}
      style={{ height: 4, cursor: 'row-resize', background: '#252525', flexShrink: 0 }}
    />

    {/* Toolbar */}
    <div
      className="script-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        background: '#141414',
        borderBottom: '1px solid #252525',
        flexShrink: 0,
      }}
    >
      <button className="rec-btn" onClick={handleGenerateScript} disabled={generating || !activeProjectId}>
        {generating ? 'Generating...' : 'Generate Script'}
      </button>
      <button className="rec-btn" onClick={handleGenerateVoiceovers} disabled={generatingTTS}>
        {generatingTTS ? 'Generating...' : 'Generate Voiceovers'}
      </button>
      <select
        value={selectedVoice}
        onChange={(e) => setSelectedVoice(e.target.value)}
        style={{
          background: '#1a1a1a',
          color: '#d0d0d0',
          border: '1px solid #252525',
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 12,
        }}
      >
        <option value="">Default Voice</option>
        {voices.map((v) => (
          <option key={v.id} value={v.voiceId}>{v.name}</option>
        ))}
      </select>
    </div>

    {/* Generation Log (collapsible, between toolbar and timeline) */}
    <GenerationLog log={generationLog} onRegenerate={handleRegenerate} />

    {/* Compact Timeline — fixed height, no flex grow */}
    <div className="script-compact-timeline" style={{ height: 80, flexShrink: 0, overflow: 'hidden' }}>
      <Timeline />
    </div>
  </div>
)
```

- [ ] **Step 5: Add CSS for script layout**

Append to `src/renderer/styles/globals.css`:

```css
/* Script View — Two-Panel Layout */
.script-layout {
  display: flex;
  flex-direction: row;
}

.script-left-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--border);
}

.script-right-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.script-editor-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.script-editor-panel-header {
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  background: #141414;
  border-bottom: 1px solid #202020;
  flex-shrink: 0;
}

.script-compact-timeline {
  border-top: 1px solid var(--border);
}

/* Generation Log */
.generation-log {
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  max-height: 200px;
  overflow-y: auto;
  flex-shrink: 0;
}

.generation-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  background: #141414;
  border-bottom: 1px solid #202020;
}

.generation-log-meta {
  font-weight: 400;
  text-transform: none;
}

.generation-log-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.generation-log-section-header:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.03);
}

.generation-log-section-content {
  padding: 4px 12px 8px 22px;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
  margin: 0;
}

.generation-log-regenerate-btn {
  display: block;
  width: calc(100% - 16px);
  margin: 4px 8px 8px;
  padding: 4px 8px;
  font-size: 11px;
  background: var(--bg-panel);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}

.generation-log-regenerate-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent-border);
}

.generation-log-prompt-form {
  padding: 4px 8px 8px;
}

.generation-log-prompt-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--bg-panel);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  resize: vertical;
  margin-bottom: 4px;
}

.generation-log-prompt-actions {
  display: flex;
  gap: 4px;
}
```

- [ ] **Step 6: Run test to verify layout renders**

Run: `npm test -- --testPathPattern script-view-layout`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/layout/PanelSystem.tsx src/renderer/components/script-editor/ScriptTimelineView.tsx src/renderer/styles/globals.css tests/integration/script-view-layout.test.tsx
git commit -m "feat: two-panel script layout with compact timeline and generation log"
```

---

### Task 7: Segment Click → Tiptap Scroll Sync

**Files:**
- Modify: `src/renderer/components/script-editor/ScriptEditorPanel.tsx`
- Modify: `src/renderer/stores/timeline-store.ts` (read selectedSegmentId)

- [ ] **Step 1: Add scroll-to-section logic in ScriptEditorPanel**

In `src/renderer/components/script-editor/ScriptEditorPanel.tsx`, add sync with `selectedSegmentId`:

```typescript
import { useTimelineStore } from '../../stores/timeline-store'

// Inside ScriptEditorPanel component:
const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)
const timeline = useTimelineStore((s) => s.timeline)

// When a segment is selected, find which section it maps to and scroll the editor
useEffect(() => {
  if (!editor || !selectedSegmentId || !timeline) return

  // Find the segment
  const segment = timeline.tracks
    .flatMap((t) => t.segments)
    .find((s) => s.id === selectedSegmentId)
  if (!segment?.metadata) return

  try {
    const meta = JSON.parse(segment.metadata) as { sectionId?: string; sectionOrder?: number }
    if (meta.sectionOrder == null) return

    // Scroll to the corresponding h2 in the editor
    const editorEl = editor.view.dom
    const headings = editorEl.querySelectorAll('h2')
    const targetHeading = headings[meta.sectionOrder]
    if (targetHeading) {
      targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  } catch { /* invalid metadata */ }
}, [selectedSegmentId, timeline, editor])
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/script-editor/ScriptEditorPanel.tsx
git commit -m "feat: clicking timeline segment scrolls Tiptap to matching section"
```

---

### Task 8: Update Existing Tests for Refactored Components

**Files:**
- Modify: `tests/integration/compose-script-layout.test.tsx`
- Modify: `tests/integration/smoke-critical-paths.test.tsx`

- [ ] **Step 1: Run full test suite and identify any regressions**

Run: `npm test`
Note any failing tests. Common breakage points:
- Tests importing `ScriptTimelineView` expecting the old layout
- Tests checking for `.panel-preview` in script preset
- Tests asserting `width: '100%'` on the script preset container

- [ ] **Step 2: Fix any test regressions**

For each failing test:
- If the test asserts old script layout structure, update assertions to match the new two-panel layout
- If the test mocks `useScriptStore`, add `generationLog: null` and `setGenerationLog: vi.fn()` to the mock

- [ ] **Step 3: Run full test suite again**

Run: `npm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: update existing tests for script view redesign"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Two-panel layout: Task 6 (PanelSystem + ScriptTimelineView refactor)
- [x] Draggable divider: Task 6 (reuses existing `handleMouseDown('sidebar')`)
- [x] Tiptap with `## Section N`: Task 3 (ScriptEditorPanel)
- [x] Section sync (edit/merge/split): Task 3 (sectionsToHtml/htmlToSections)
- [x] AI generation + store: Task 2 (prompt metadata) + Task 6 (wiring)
- [x] Generate Voiceovers fix: Task 1 (edge-tts error handling)
- [x] Post-generation log: Task 4 (GenerationLog component)
- [x] Regenerate with custom prompt: Task 4 + Task 6 (handleRegenerate)
- [x] Compact timeline ~80px: Task 6 (fixed height div)
- [x] ScriptTextTrack hidden: Task 5 (conditional render)
- [x] No script in thumbnails: Already done (segment-script-preview removed)
- [x] Segment → Tiptap scroll: Task 7
- [x] Video preview preserved: Task 6 (PlaybackPanel unchanged)

**Placeholder scan:** No TBD, TODO, or "similar to Task N" found.

**Type consistency:** `GenerationLog` type defined in Task 2, used consistently in Tasks 4, 6. `sectionsToHtml`/`htmlToSections` signatures match between Task 3 test and implementation.
