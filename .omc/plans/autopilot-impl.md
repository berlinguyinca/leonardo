# Implementation Plan: Script-Split + Edge-TTS + Inline Editing

## Overview

10 features, 28 acceptance criteria, ~15 files to modify/create. Organized into 6 work streams that can be partially parallelized.

## Work Streams

### Stream 1: Database + Store Foundation (MUST BE FIRST)
Everything depends on the metadata column and new store actions.

**Task 1.1: Add metadata column to segments table**
- File: `src/main/services/project-store.ts`
- Add migration: `ALTER TABLE segments ADD COLUMN metadata TEXT DEFAULT NULL` (idempotent try/catch pattern at ~line 108)
- Update `saveTimeline()` INSERT to include metadata: add `seg.metadata ?? null` parameter
- Update `getTimeline()` row mapping to include `metadata: sr.metadata ?? undefined`
- Tests: integration test with real SQLite — save timeline with metadata, reload, verify

**Task 1.2: Add `splitClipBySections()` to timeline store**
- File: `src/renderer/stores/timeline-store.ts`
- New action that takes `(segmentId: string, sections: ScriptSection[])`:
  1. Find the segment by ID
  2. Calculate total word count across all sections
  3. For each section: create a new segment with word-count-proportional duration
     - `startTime` = previous segment's endTime (or original segment's startTime for first)
     - `endTime` = startTime + (sectionWordCount / totalWordCount) * originalDuration
     - `sourceFile` = original segment's sourceFile
     - `sourceOffset` = proportional offset into the source video
     - `label` = section text truncated to 40 chars
     - `metadata` = JSON.stringify({ sectionId: section.id, sectionOrder: section.order })
  4. Replace the original segment with N new segments in the track
  5. Call `computeDuration()` to update timeline duration
- Tests: unit test — split a 10s segment by 3 sections (word counts 10, 20, 10) → 3 segments of 2.5s, 5s, 2.5s

**Task 1.3: Add `adjustSegmentDuration()` to timeline store**
- File: `src/renderer/stores/timeline-store.ts`
- New action `(segmentId: string, newDurationMs: number)`:
  1. Find the segment
  2. Enforce minimum: `Math.max(newDurationMs, TIMELINE_SEGMENT_MIN_DURATION_MS)`
  3. Calculate delta = newDuration - currentDuration
  4. Update this segment's endTime = startTime + newDuration
  5. Shift ALL subsequent segments (same track, startTime >= this segment's original endTime) by delta
  6. Call `computeDuration()`
- Tests: unit test — adjust middle segment longer → subsequent segments shift right; adjust shorter → shift left

### Stream 2: Edge-TTS Provider (INDEPENDENT — can run in parallel with Stream 1)

**Task 2.1: Install edge-tts dependency**
- Run: `npm install edge-tts`
- Add `'edge-tts'` to `TTSEngineType` in `src/shared/types/tts.ts`

**Task 2.2: Create edge-tts provider**
- New file: `src/main/services/tts/edge-tts-provider.ts`
- Implements `ITTSProvider` interface
- Constructor: no args needed (free, no API key)
- `synthesize(text, voice)`: use edge-tts API to generate audio, save to temp dir, return `{ filePath, duration, sectionId }`
- `getVoices()`: use edge-tts voice listing, map to `VoiceProfile[]` format
- `testConnection()`: try to list voices, return true/false
- `isAvailable`: always true (no binary or API key dependency)
- Tests: unit test with mocked edge-tts; integration test (skipIf no network)

**Task 2.3: Register edge-tts in provider factory**
- File: `src/main/services/tts/index.ts`
- Add `case 'edge-tts': return new EdgeTTSProvider()` to `createTTSProvider()` switch

**Task 2.4: Create TTS IPC handler**
- New file: `src/main/ipc/tts.ipc.ts`
- Register handlers for:
  - `TTS_SYNTHESIZE`: takes `{ text, voice, engine }` → returns `TTSSynthesisResult`
  - `tts:list-voices`: takes `{ engine }` → returns `VoiceProfile[]`
  - `tts:test-connection`: takes `{ engine }` → returns boolean
- Use `safeHandle()` wrapper (errors re-throw to renderer)
- File: `src/main/index.ts` — add `registerTTSIPC()` call
- File: `src/preload/index.ts` — add `tts` bridge methods
- Tests: handler unit tests with mocked provider

### Stream 3: Workspace Reorder + Script Page Layout (DEPENDS ON Stream 1)

**Task 3.1: Reorder workspace tabs**
- File: `src/renderer/components/layout/Toolbar.tsx`
- Change `WORKSPACE_TABS` order to: Record → Script → Compose → Effects → Export

**Task 3.2: Update default presets**
- File: `src/renderer/stores/ui-store.ts`
- Default `workspacePreset` stays `'compose'` (for existing projects)
- After recording stops: change `setWorkspacePreset('compose')` → `setWorkspacePreset('script')` in RecordingControls
- File: `src/renderer/components/browser/RecordingControls.tsx` — update the "Edit Now" button to navigate to 'script'

**Task 3.3: Create ScriptTimelineView**
- New file: `src/renderer/components/script-editor/ScriptTimelineView.tsx`
- Layout: Preview panel (top, ~40% height) + Timeline with ScriptTextTrack (bottom, ~60% height)
- Top panel: `<PlaybackPanel />` (reuse existing)
- Bottom panel: `<Timeline />` (reuse existing) + `<ScriptTextTrack />` (new)
- Horizontal resize divider between top and bottom
- Toolbar section: "Generate Script" button, "Generate Voiceovers" button, voice dropdown

**Task 3.4: Replace ScriptPresetView in PanelSystem**
- File: `src/renderer/components/layout/PanelSystem.tsx`
- In the `preset === 'script'` branch: replace `<ScriptPresetView />` with `<ScriptTimelineView />`
- Ensure preview panel renders in script preset

**Task 3.5: Ensure preview panel in all non-recording views**
- File: `src/renderer/components/layout/PanelSystem.tsx`
- Verify Compose already has preview (yes, via ComposeView)
- Verify Effects already has preview (EffectsCanvas renders its own canvas but not PlaybackPanel — may need adding)
- Verify Export already has preview (yes, PlaybackPanel)

### Stream 4: Script Text Track + Inline Editing (DEPENDS ON Stream 1)

**Task 4.1: Create ScriptTextTrack component**
- New file: `src/renderer/components/timeline/ScriptTextTrack.tsx`
- Renders below the video track in the timeline
- For each segment that has a matching script section (via metadata.sectionId or clipScripts mapping):
  - Render a text block aligned to the segment's pixel position (using `timeToPixel()`)
  - Show the section's full text (or truncated with tooltip)
  - Apply `segment-script-text` class with appropriate styling
- Scrolls in sync with the timeline (shares ScrollContainer or syncs scroll position)
- Props: timeline, zoomLevel, scrollLeft

**Task 4.2: Add ScriptTextTrack to Timeline component**
- File: `src/renderer/components/timeline/Timeline.tsx`
- Render `<ScriptTextTrack>` after the track lanes
- Pass timeline, zoomLevel, and scroll state

**Task 4.3: Add double-click editing to ScriptTextTrack**
- In `ScriptTextTrack.tsx`: each text block gets `onDoubleClick`
- Opens `InlineTextPopup` (reuse existing component) at click position
- On save:
  1. Call `useScriptStore.getState().updateSection(sectionId, { text: newText })`
  2. Estimate new duration: `Math.round((wordCount(newText) / 150) * 60 * 1000)`
  3. Call `useTimelineStore.getState().adjustSegmentDuration(segmentId, estimatedDuration)`
- On close: dismiss popup
- Tests: component test — render, double-click, verify popup appears, save, verify store updated

**Task 4.4: Add CSS styles for script text track**
- File: `src/renderer/styles/globals.css`
- `.script-text-track` — row below video tracks
- `.script-text-segment` — individual text blocks aligned to segments
- `.script-text-segment.stale` — orange left border for stale voiceovers
- `.script-text-segment:hover` — subtle highlight
- Double-click cursor

### Stream 5: Auto-Split on Script Generation (DEPENDS ON Streams 1 + 3)

**Task 5.1: Wire auto-split after script generation**
- The current flow: ClipContextMenu calls `window.leonardo.ai.generateScript()` → returns script → stores sections
- After storing sections: call `splitClipBySections()` on the existing segment for that clip
- File: `src/renderer/components/clip-library/ClipContextMenu.tsx` — after `setSections(result.script.sections)`, find the clip's segment and call `splitClipBySections(segmentId, sections)`
- Also wire in ScriptTimelineView's "Generate Script" button (same pattern)
- Needs: find the segment by sourceFile matching clip.filePath

**Task 5.2: Update auto-save to handle split segments**
- The auto-save subscriber already handles timeline changes
- Verify split operations trigger the debounced save
- Verify metadata is persisted (from Task 1.1)

### Stream 6: TTS Integration + Synced Playback (DEPENDS ON Streams 2 + 4)

**Task 6.1: Wire "Generate Voiceovers" button**
- In `ScriptTimelineView.tsx` toolbar:
  - "Generate Voiceovers" button
  - Voice dropdown populated from `tts:list-voices` IPC call
  - On click: iterate all script sections → call `tts:synthesize` for each → collect results
  - After each result: call `adjustSegmentDuration(segmentId, result.duration)` to snap durations
  - Store voiceover file paths in script section metadata or a new store field
  - Show progress indicator during bulk generation

**Task 6.2: Stale audio indicators**
- Track voiceover state per section: `{ filePath, textHash, stale: boolean }`
- When text is edited (Task 4.3 onSave), mark the corresponding voiceover as stale
- In ScriptTextTrack rendering: show orange warning icon on stale segments
- "Regenerate" option per-section or via bulk "Generate Voiceovers" button

**Task 6.3: Synced audio playback**
- File: `src/renderer/components/preview/PlaybackPanel.tsx`
- When a segment has a voiceover audio file (not stale), create an `<audio>` element alongside the `<video>`
- Sync audio to playhead position: when video seeks, audio seeks to matching position
- During playback: both play simultaneously
- On segment boundary: switch to next segment's audio file
- Pause/resume both together
- Tests: component test — verify audio element created when voiceover exists

### Stream 7: Tests (RUNS AFTER each stream)

**Task 7.1: Timeline store tests**
- `splitClipBySections` — word-count proportional durations, metadata set, undo/redo
- `adjustSegmentDuration` — extend pushes right, contract pulls left, minimum enforced

**Task 7.2: Edge-TTS provider tests**
- Implements ITTSProvider interface
- getVoices returns VoiceProfile array
- synthesize returns file path + duration

**Task 7.3: TTS IPC handler tests**
- Handler registration
- Error propagation (safeHandle re-throws)

**Task 7.4: ScriptTextTrack component tests**
- Renders text aligned under segments
- Double-click opens inline editor
- Save updates store and adjusts duration
- Stale indicator shows after edit

**Task 7.5: Integration tests**
- Real SQLite: save timeline with metadata → reload → metadata preserved
- Split + adjust round trip: split a clip → adjust durations → save → reload → verify

**Task 7.6: Coverage verification**
- Run `npx vitest --coverage` on new files
- Verify 90%+ statements, branches, functions, lines

## Execution Order

```
Stream 1 (Foundation) ──────────────────────────────┐
  Task 1.1 (DB migration)                           │
  Task 1.2 (splitClipBySections)                     ├── SEQUENTIAL
  Task 1.3 (adjustSegmentDuration)                   │
                                                     │
Stream 2 (Edge-TTS) ─── PARALLEL WITH Stream 1 ─────┤
  Task 2.1 (npm install)                             │
  Task 2.2 (provider)                                │
  Task 2.3 (factory)                                 │
  Task 2.4 (IPC handlers)                            │
                                                     │
Stream 3 (Layout) ─── AFTER Stream 1 ───────────────┤
  Task 3.1 (tab reorder)                             │
  Task 3.2 (default presets)                         │
  Task 3.3 (ScriptTimelineView)                      │
  Task 3.4 (PanelSystem swap)                        │
  Task 3.5 (preview panel check)                     │
                                                     │
Stream 4 (Text Track) ─── AFTER Stream 1 ──── ─────┤
  Task 4.1 (ScriptTextTrack)                         │
  Task 4.2 (Timeline integration)                    │
  Task 4.3 (inline editing)                          │
  Task 4.4 (CSS)                                     │
                                                     │
Stream 5 (Auto-Split) ─── AFTER Streams 1+3 ────────┤
  Task 5.1 (wire generation)                         │
  Task 5.2 (auto-save verify)                        │
                                                     │
Stream 6 (TTS UI) ─── AFTER Streams 2+4 ────────────┤
  Task 6.1 (Generate Voiceovers button)              │
  Task 6.2 (stale indicators)                        │
  Task 6.3 (synced playback)                         │
                                                     │
Stream 7 (Tests) ─── AFTER each stream ──────────────┘
  Tasks 7.1-7.6 (tests per feature)
```

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| edge-tts package API changes | Pin version, wrap in thin adapter |
| Scroll sync between text track and video track | Share ScrollContainer ref, not separate scroll |
| Audio/video sync drift during playback | Use requestAnimationFrame loop syncing to video.currentTime |
| Large number of sections causing perf issues | Virtualize text track rendering for >20 sections |
| Undo/redo with split operations | splitClipBySections is a single `set()` call → one undo step |
