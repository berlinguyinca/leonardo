# Deep Interview Spec: Script View Redesign

## Metadata
- Interview ID: script-view-redesign-2026-04-13
- Rounds: 5
- Final Ambiguity Score: 17%
- Type: brownfield
- Generated: 2026-04-13
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.35 | 0.333 |
| Constraint Clarity | 0.75 | 0.25 | 0.188 |
| Success Criteria | 0.80 | 0.25 | 0.200 |
| Context Clarity | 0.75 | 0.15 | 0.113 |
| **Total Clarity** | | | **0.833** |
| **Ambiguity** | | | **17%** |

## Goal
Redesign the Script workspace preset into a two-panel layout: a Tiptap rich-text editor on the left for writing/editing script sections (using `## Section N` headers as delimiters), and a right panel containing video preview (PlaybackPanel) on top, a toolbar with Generate Script/Voiceovers buttons, and a compact content-fitted timeline (~80px) showing only video track segments (no ScriptTextTrack). Additionally: fix TTS to actually produce audio, add a post-generation log showing the full AI prompt/context/response, and ensure no script text is burned into timeline segment thumbnails.

## Constraints
- **Layout**: Script preset = left sidebar (Tiptap editor, ~40% width) + right panel (video preview + toolbar + compact timeline)
- **Tiptap sync**: `## Section N` headers delimit sections. Each header+content = one ScriptSection. Merge on header deletion, split on header insertion. Sections stored in `script-store.ts` remain the source of truth.
- **Timeline**: In script view, timeline must auto-fit to content height (~80px: 30px ruler + 50px video track). ScriptTextTrack is hidden in script preset. No `flex: 1` stretching.
- **TTS**: Edge-TTS must actually produce playable audio files. Debug and fix the synthesize IPC call. Duration should ideally come from actual audio, not word-count estimate.
- **Generation log**: Post-generation only. Collapsible sections: System Prompt, User Message (with context: URL, duration, DOM events), AI Response. Plus a "Regenerate with custom prompt" button.
- **No script in thumbnails**: `segment-script-preview` already removed from Segment.tsx (done earlier this session). Must stay removed.
- **Resizable**: Left/right panel split should have a draggable divider. Video preview / timeline split within the right panel should also be resizable (existing behavior).

## Non-Goals
- No editable system prompt or context (read-only in generation log)
- No inline script editing on the timeline (Tiptap is the sole editor in script view)
- No change to other workspace presets (record, compose, effects, export)
- No new AI providers or prompt template restructuring
- No audio duration analysis from MP3 files (word-count estimate acceptable for now if TTS actually works)

## Acceptance Criteria
- [ ] Script preset shows two-panel layout: Tiptap editor left, video+toolbar+timeline right
- [ ] Left/right divider is draggable (min 25%, max 60% for left panel)
- [ ] Tiptap content uses `## Section N` as section delimiters
- [ ] Editing text below a header updates the corresponding ScriptSection.text in script-store
- [ ] Deleting a `##` header merges its content with the previous section
- [ ] Inserting a new `##` header splits the section, creating a new ScriptSection
- [ ] Section order in Tiptap matches ScriptSection.order
- [ ] When script is generated, Tiptap populates with `## Section N` headers + text
- [ ] Generate Script button calls AI and populates sections (existing behavior, verify still works)
- [ ] Generate Voiceovers button produces actual audio files (not silence/empty)
- [ ] Voiceover audio plays back during video playback (PlaybackPanel audio element)
- [ ] After script generation, a collapsible log appears showing: system prompt, user message, context, AI response
- [ ] "Regenerate with custom prompt" button in the log allows re-generating with modified prompt text
- [ ] Timeline in script view is ~80px tall (ruler + video track only)
- [ ] ScriptTextTrack is not rendered in script view
- [ ] No script text appears overlaid on segment thumbnails
- [ ] Video preview syncs with playhead position (existing behavior preserved)
- [ ] Clicking a segment in the timeline scrolls Tiptap to the corresponding section

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Timeline needed in script view | Contrarian: why have timeline at all if Tiptap is the editor? | Keep timeline for visual navigation/context, but compact (tracks only, ~80px) |
| Script text on timeline segments useful | Two editing surfaces for same data | ScriptTextTrack hidden in script view; Tiptap is sole editor |
| User wants editable prompt config | Could be a full editor or just transparency | Post-generation log (read-only) + "regenerate with custom prompt" button |
| TTS timing from word count is fine | Duration estimate could desync | Audio must actually be produced first; word-count estimate acceptable for MVP |
| Paragraph boundaries = sections | Fragile with blank lines | Section headers (`## Section N`) as explicit delimiters instead |

## Technical Context

### Existing Components to Wire
- `TiptapEditor.tsx` — Tiptap rich-text editor, needs section header extension/parsing
- `PanelSystem.tsx` — script preset currently renders only `ScriptTimelineView`; needs two-panel layout
- `ScriptTimelineView.tsx` — currently owns entire script view; refactor to right-panel content only
- `PlaybackPanel.tsx` — video preview, already works with media:// fix applied
- `Timeline.tsx` — needs conditional ScriptTextTrack hiding based on workspace preset
- `script-store.ts` — ScriptSection CRUD, clipScripts, voiceovers; source of truth
- `EdgeTTSProvider.ts` — synthesize method; debug why no audio produced

### New Components Needed
- `ScriptEditorPanel.tsx` — Tiptap wrapper with section header parsing + sync logic
- `GenerationLog.tsx` — collapsible log of last AI generation (system prompt, user message, response)

### IPC Changes
- AI generate script handler should return the full prompt/context alongside the result (for the generation log)
- TTS synthesize needs debugging (may need to verify edge-tts package actually writes audio)

### CSS Changes
- Script preset: two-column flexbox with resizable divider
- Timeline in script view: fixed height (~80px), no flex grow
- Generation log: collapsible sections with dark theme styling

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| ScriptSection | core domain | id, text, order, voiceProfileId, timingMarkers | belongs to Clip via clipScripts; maps 1:1 to timeline Segment |
| TiptapEditor | supporting UI | content (HTML), section headers | renders ScriptSection[] as `## Section N` + text |
| PlaybackPanel | supporting UI | activeSegment, videoTime, voiceoverSrc | syncs with Timeline playhead; plays Voiceover audio |
| Timeline | supporting UI | tracks, ruler, playhead | compact mode in script view; hides ScriptTextTrack |
| Voiceover | core domain | filePath, duration, stale, textHash | belongs to ScriptSection; produced by EdgeTTSProvider |
| AI Prompt | supporting | systemPrompt, userMessage, context | assembled by prompt-templates.ts; sent to Claude/Codex/Ollama |
| GenerationLog | supporting UI | systemPrompt, userMessage, response, timestamp | displayed after script generation; collapsible sections |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 6 | 6 | - | - | N/A |
| 2 | 6 | 0 | 0 | 6 | 100% |
| 3 | 7 | 1 | 0 | 6 | 86% |
| 4 | 7 | 0 | 0 | 7 | 100% |
| 5 | 7 | 0 | 0 | 7 | 100% |

## Interview Transcript
<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1
**Q:** The script preset currently gives 100% width to ScriptTimelineView (video preview on top, timeline on bottom). You want a script editor on the left side. Which layout do you envision for the script view?
**A:** Left: TiptapEditor, Right: Video+Timeline — Tiptap rich text editor on the left as a word-processor-style full document with sections as paragraphs. Right panel has video preview + timeline.
**Ambiguity:** 62% (Goal: 0.60, Constraints: 0.20, Criteria: 0.20, Context: 0.50)

### Round 2
**Q:** When you say 'generate voice button doesn't work right', what specifically happens?
**A:** No audio produced at all — The button completes but no voiceover audio is generated or plays back.
**Ambiguity:** 53% (Goal: 0.65, Constraints: 0.40, Criteria: 0.25, Context: 0.55)

### Round 3
**Q:** You want to 'see what context was sent to Claude and modify the prompt'. In the AI prompt config panel, what specifically should the user be able to see and edit?
**A:** Post-generation log only — After generation, show a collapsible log of exactly what was sent (full prompt + full context). No editing — just transparency for debugging. Separate 'regenerate with custom prompt' button.
**Ambiguity:** 37% (Goal: 0.80, Constraints: 0.50, Criteria: 0.50, Context: 0.65)

### Round 4 (Contrarian mode)
**Q:** With Tiptap on the left for editing and ScriptTextTrack on the timeline also showing script text with inline editing — two editing surfaces for the same data — should the timeline in script view keep or remove the script track?
**A:** Show tracks only, no script text — Timeline shows video segments and playhead for navigation, but ScriptTextTrack is hidden since Tiptap handles all editing. Minimal height ~80px.
**Ambiguity:** 27% (Goal: 0.85, Constraints: 0.70, Criteria: 0.60, Context: 0.70)

### Round 5
**Q:** When the user edits script text in Tiptap, how should it sync with the underlying ScriptSection data model? Each section currently maps to a timeline segment.
**A:** Section headers as delimiters — `## Section N` headers in Tiptap. Each header+content = one ScriptSection. Delete header = merge with previous. Insert header = split into new section.
**Ambiguity:** 17% (Goal: 0.95, Constraints: 0.75, Criteria: 0.80, Context: 0.75)

</details>
