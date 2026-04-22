# Deep Interview Spec: Script-Based Clip Splitting, Microsoft TTS, and Inline Script Editing

## Metadata
- Interview ID: script-split-tts-2026-04-13
- Rounds: 11
- Final Ambiguity Score: 8%
- Type: brownfield
- Generated: 2026-04-13
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.35 | 0.333 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.88 | 0.25 | 0.220 |
| Context Clarity | 0.90 | 0.15 | 0.135 |
| **Total Clarity** | | | **0.900** |
| **Ambiguity** | | | **10%** |

## Goal

Transform the **script workspace preset** from a full-screen text editor into a **timeline-based script editing experience** where:
1. Generating a script auto-splits a clip into multiple timeline segments (one per script section, duration proportional to word count)
2. A **script text track** below the video track shows each section's text aligned under its segment
3. Users **double-click** text to edit it inline
4. Editing longer text **automatically extends** the segment with a freeze frame and **pushes** all subsequent segments right
5. A **"Generate Voiceovers"** button triggers edge-tts for all sections, after which segment durations **snap to actual audio lengths**

**Workspace order (reordered to match production workflow):**
1. **Record** — capture screen interactions
2. **Script** — generate script, auto-split, edit text, generate voiceovers (NEW position: 2nd, was 3rd)
3. **Compose** — clip layout, intros, exits, transitions
4. **Effects** — overlays, text effects
5. **Export** — final output

**Preview panel** in all non-recording views (Script, Compose, Effects, Export). Script page layout: preview panel (top) + timeline with script text track (bottom).

**Workspace separation:**
- **Script page** = script generation, text editing, TTS, segment splitting, with video preview
- **Compose page** = clip layout, intros, exits, transitions (unchanged)

## Constraints
- **TTS provider:** edge-tts (free, no API key, ~100 voices)
- **TTS is on-demand:** triggered manually via toolbar button, NOT automatic after script generation
- **Voice selection:** dropdown in script page toolbar with available edge-tts voices
- **Initial split duration:** word-count proportional (section with 40% of words → 40% of clip duration)
- **Freeze frame behavior:** when text edit makes narration longer, segment extends (last frame holds), all subsequent segments shift right. Same when TTS audio is longer than current segment.
- **No re-rendering needed:** freeze frames are timeline-level (the video source stays unchanged; the segment just holds the last frame longer via extended endTime with same sourceFile)
- **Script text is NOT shown in compose view** — only in the script page
- **Undo/redo must work** for all operations (via existing Zundo middleware)
- **Stale audio handling:** when text is edited after TTS, mark the voiceover as stale (orange warning icon). Old audio stays playable but flagged. User re-generates per-section or bulk.
- **Synced playback:** in the script page, pressing play plays video + voiceover audio simultaneously, synced to timeline position
- **90%+ test coverage** (statements, branches, functions, lines) for all new code. Real integration tests — not circular mocked tests (lesson from runtime diagnosis).
- **No AI-generated slop:** no dead code, no speculative abstractions, no commented-out blocks, no unnecessary wrappers. Every function earns its existence.
- **No major code duplication:** extract shared logic into reusable functions. Reuse existing patterns (ITTSProvider interface, computeDuration, InlineTextPopup, auto-save subscriber). If two components share >10 lines of identical logic, extract it.

## Non-Goals
- ElevenLabs integration changes (existing provider stays as-is, upgraded later)
- Compose view changes (layout stays as-is)
- Automatic TTS after script generation
- Video file splitting (segments reference time ranges in the same source file)
- Script generation changes (Claude CLI integration was just fixed, keep as-is)

## Acceptance Criteria
- [ ] Generating a script for a clip with N sections creates N timeline segments, each with word-count-proportional duration
- [ ] Script page shows a timeline with a video track (segments) and a script text track (section text aligned under each segment)
- [ ] The old full-screen ScriptPresetView is replaced with the new timeline + text track layout
- [ ] Double-clicking a script text section opens an inline text editor
- [ ] Saving edited text updates the script section in the store
- [ ] Editing text to be longer (more words) extends the segment duration and pushes subsequent segments right
- [ ] Editing text to be shorter contracts the segment and pulls subsequent segments left
- [ ] A "Generate Voiceovers" button appears in the script page toolbar
- [ ] A voice selection dropdown shows available edge-tts voices
- [ ] Clicking "Generate Voiceovers" runs edge-tts on all script sections
- [ ] After TTS completes, segment durations snap to actual audio file lengths
- [ ] If TTS audio is longer than current segment, a freeze frame extends the segment and pushes subsequent segments
- [ ] Edge-tts provider implements the ITTSProvider interface (synthesize, getVoices, testConnection)
- [ ] All operations are undo/redo compatible
- [ ] Segment metadata column is added to the SQLite database (migration)
- [ ] Auto-save persists the split segments and script text to the database
- [ ] Editing text after TTS shows an orange "stale" indicator on that segment's voiceover
- [ ] Stale voiceovers remain playable until regenerated
- [ ] Pressing play in the script page plays video and voiceover audio in sync
- [ ] Audio playback follows the playhead position across segment boundaries
- [ ] Workspace tabs are reordered: Record → Script → Compose → Effects → Export
- [ ] Script page has a video preview panel (top) + timeline with text track (bottom)
- [ ] Preview panel is present in Script, Compose, Effects, and Export presets
- [ ] Default workspace preset after recording is 'script' (was 'compose')
- [ ] 90%+ test coverage (statements, branches, functions, lines) for all new code
- [ ] Integration tests exercise real IPC round-trips (not just mocked behavior)
- [ ] No dead code, commented-out blocks, or speculative abstractions
- [ ] No code duplication >10 lines — shared logic extracted into reusable functions
- [ ] All new components reuse existing patterns (ITTSProvider, InlineTextPopup, auto-save, computeDuration)

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| TTS runs automatically after script generation | "Wouldn't you want to edit first?" | TTS is manual — edit script text first, then generate voiceovers on demand |
| Script editing happens in the script panel (text editor) | "Where should script operations live?" | All script operations in the script PAGE (timeline + text track), not compose |
| Compose view needs changes | "What is compose for?" | Compose = layout only (clips, intros, exits, transitions). No script text in compose. |
| Freeze frames require video re-rendering | Simplifier challenge | Freeze = segment extends beyond source video duration (last frame holds). No re-rendering. |
| Clip is split into separate video files | "What does split mean?" | Split = multiple timeline segments referencing different time ranges in ONE source file |
| Auto-split needs accurate timing from AI | "Section timing is often 0/0" | Use word-count proportional duration. TTS refines later. |

## Technical Context

### Files to Modify
| File | Change |
|------|--------|
| `src/main/services/tts/edge-tts-provider.ts` | **NEW** — implement ITTSProvider with edge-tts npm package |
| `src/main/services/tts/index.ts` | Register edge-tts provider in createTTSProvider() |
| `src/main/services/project-store.ts` | Add `metadata TEXT` column to segments table; update save/load |
| `src/main/ipc/ai.ipc.ts` | After script generation, trigger auto-split (or return sections for renderer to split) |
| `src/renderer/stores/timeline-store.ts` | Add `splitClipBySections(clipId, sections)` action |
| `src/renderer/stores/timeline-store.ts` | Add `adjustSegmentDuration(segmentId, newDuration)` with push logic |
| `src/renderer/components/layout/PanelSystem.tsx` | Replace ScriptPresetView with new ScriptTimelineView in script preset |
| `src/renderer/components/script-editor/ScriptTimelineView.tsx` | **NEW** — timeline + script text track layout |
| `src/renderer/components/timeline/ScriptTextTrack.tsx` | **NEW** — renders script section text aligned under segments |
| `src/renderer/components/timeline/Segment.tsx` | Add onDoubleClick handler for inline text editing |
| `src/shared/types/ai.ts` | No changes needed (ScriptSection already has all fields) |
| `src/shared/types/timeline.ts` | No changes needed (Segment.metadata already exists as optional string) |
| `src/renderer/components/layout/Toolbar.tsx` | Reorder WORKSPACE_TABS: Record → Script → Compose → Effects → Export |
| `src/renderer/stores/ui-store.ts` | Change default workspacePreset to 'recording'; post-recording default to 'script' |

### Existing Patterns to Reuse
- `ITTSProvider` interface (`src/shared/interfaces/tts-provider.ts`) — edge-tts provider follows this
- `InlineTextPopup` (`src/renderer/components/timeline/InlineTextPopup.tsx`) — reuse for double-click editing
- `computeDuration()` in timeline-store.ts — reuse for recalculating total duration after splits
- `useScriptStore.clipScripts` — already maps clipId → ScriptSection[]
- Segment metadata pattern from overlays — JSON.stringify/parse for section references
- Auto-save subscriber in timeline-store.ts — already handles debounced persistence

### Data Flow
```
1. User generates script (Claude CLI) → N ScriptSections returned
2. Auto-split: splitClipBySections(clipId, sections)
   → Original single segment replaced by N segments
   → Each segment: { startTime: proportional, endTime: proportional, sourceFile: clip.filePath, sourceOffset: proportionalStart }
   → Section text stored in clipScripts[clipId] (existing pattern)
3. Script page renders: Timeline (video track) + ScriptTextTrack (text under each segment)
4. User double-clicks text → InlineTextPopup opens → edit → save
   → updateSection() in script store
   → Estimate new duration: wordCount / 150 * 60 * 1000 (ms)
   → adjustSegmentDuration(segmentId, newEstimatedDuration)
   → If longer: extend segment, push subsequent segments right
   → If shorter: contract segment, pull subsequent segments left
5. User clicks "Generate Voiceovers"
   → edge-tts synthesizes each section → TTSSynthesisResult[]
   → For each result: adjustSegmentDuration(segmentId, result.duration)
   → Durations snap to actual audio lengths
```

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Clip | core domain | id, filePath, duration, projectId, url, resolution | has many Segments (after split) |
| Segment | core domain | id, trackId, startTime, endTime, sourceFile, sourceOffset, label, metadata | belongs to Track; maps 1:1 to ScriptSection (after split) |
| ScriptSection | core domain | id, scriptId, text, order, startTime, endTime, voiceProfileId | maps 1:1 to Segment; produces VoiceOver |
| VoiceOver | planned | filePath, duration, sectionId | belongs to ScriptSection; generated by edge-tts |
| ScriptTextTrack | UI component | visual track rendering | renders ScriptSection.text aligned under Segments |
| FreezeFrame | behavior | extends segment endTime beyond source video | triggered by text edit (WPM estimate) or TTS snap |
| ManualPipeline | workflow | generate → edit → TTS on demand | user controls each step |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 4 | 4 | - | - | N/A |
| 2 | 4 | 0 | 0 | 4 | 100% |
| 3 | 5 | 1 | 0 | 4 | 80% |
| 4 | 6 | 1 | 1 | 4 | 83% |
| 5 | 7 | 1 | 0 | 6 | 86% |
| 6-8 | 7 | 0 | 0 | 7 | 100% |

## Interview Transcript
<details>
<summary>Full Q&A (10 rounds)</summary>

### Round 1
**Q:** When you say 'auto-split clips based on sections' — what should 'split' mean concretely?
**A:** Multiple segments — one clip becomes N timeline segments, each mapped to one script section. Source video stays as one file.
**Ambiguity:** 68%

### Round 2
**Q:** For Microsoft TTS, which approach: edge-tts (free) or Azure Speech Services (API key)?
**A:** edge-tts (free) — no API key, good for drafts before ElevenLabs.
**Ambiguity:** 59%

### Round 3
**Q:** Walk me through the user journey from 'script generated' to 'timeline with split segments and voiceovers'.
**A:** Fully automatic pipeline... BUT user corrected: TTS is NOT automatic. Script editing happens in the script page. Compose is for layout only.
**Ambiguity:** 49%

### Round 4 (Contrarian)
**Q:** What should the script page layout look like? Currently it's a full-screen text editor with no timeline.
**A:** Timeline + text below — segments in video track, script text in a track below. Full-screen editor is replaced. Double-click to edit.
**Ambiguity:** 40%

### Round 5
**Q:** When you say editing text should extend the video with freeze frames — what concretely?
**A:** Extend segment + push others. The edited segment gets longer (last frame holds). All subsequent segments shift right.
**Ambiguity:** 32%

### Round 6 (Simplifier)
**Q:** How does the user trigger TTS? And should segment durations snap to actual audio lengths?
**A:** Bulk "Generate Voiceovers" button + voice dropdown. After TTS, segment durations snap to audio lengths with freeze frames as needed.
**Ambiguity:** 21%

### Round 7
**Q:** What determines initial segment duration before TTS?
**A:** Word-count proportional — section with 40% of words gets 40% of clip duration.
**Ambiguity:** 15%

### Round 8
**Q:** After generating voiceovers via edge-tts, the user might edit the text. What happens to the existing audio?
**A:** Mark stale + re-gen on demand. Show orange warning icon. Old audio stays playable but flagged as out-of-date.
**Ambiguity:** 12%

### Round 9
**Q:** Should the user be able to play voiceover audio synced to video in the script page timeline?
**A:** Yes, synced playback. Video + voiceover audio play simultaneously, synced to timeline position.
**Ambiguity:** 10%

### Round 10
**Q:** You want workflow reordered to Record → Script → Compose → Effects → Export. Should preview work in all non-recording views?
**A:** Yes — preview in Script + Effects + Compose + Export. Script page gets preview panel (top) + timeline with text track (bottom).
**Ambiguity:** 8%

</details>
