# Plan: Workspace Preset Restructure (3-preset to 4-preset)

## Metadata
- **Date:** 2026-04-12
- **Complexity:** HIGH
- **Baseline:** 472 tests passing (60 files)
- **Branch:** `feature/workspace-preset-restructure`
- **Revision:** 2 (addresses Architect + Critic feedback from R1)

---

## 1. Requirements Summary

Restructure the Leonardo edit page from 3 workspace presets (`recording | editing | export`) to 4 presets (`recording | compose | script | export`).

**Core deliverables:**
- **Compose view** with a storyboard panel of reorderable step cards synced bidirectionally with the timeline
- **Script view** with dedicated script-editor + video preview + timeline layout
- **DualPaneView removal** -- its split-pane functionality is superseded by the new Script preset layout
- **DOM event chips** draggable from events list onto script sections (1-N per section)
- **[ACTION: ...] markers** in scripts referencing assigned DOM events
- **AI backend selector** with global default + per-step override (claude/codex/ollama)
- **Unified IAIProvider interface** with streaming support for real-time operation log
- **Auto freeze-frame** calculation based on WPM vs event gap, with user-overridable duration
- **Error log** with copy-paste for AI invocation failures
- All 472 existing tests must continue to pass

---

## 2. RALPLAN-DR Summary

### Principles (5)

1. **Additive over destructive** -- Add new presets and views alongside existing code; only remove DualPaneView, `'dual-pane'` EditorView, and `'editing'` preset in the FINAL cleanup phase (Phase 6). No type removals until replacements are fully wired and tested.
2. **Type-first development** -- Extend shared types and interfaces before touching components. Types form the contract between phases.
3. **Store-mediated sync with loop guard** -- Compose storyboard and timeline communicate through a shared Zustand store (compose-store) with an explicit `_syncing` flag to prevent infinite bidirectional update loops triggered by timeline-store's auto-save subscriber.
4. **Streaming as progressive enhancement** -- The IAIProvider interface gains an optional `generateScriptStream()` method. Non-streaming providers still work via the existing `generateScript()`.
5. **Test-preserving migration** -- Every refactoring step must keep the 472-test baseline green. Tests that reference removed concepts (DualPaneView, `editing` preset, `dual-pane` EditorView) are migrated in the final cleanup phase, not before.

### Decision Drivers (top 3)

1. **Existing test stability** -- 472 tests across 60 files. Breaking changes to `WorkspacePreset`, `EditorView`, or `PanelSystem` props will cascade. The plan must sequence changes so tests stay green at each phase boundary.
2. **IPC surface area** -- Streaming script generation requires a new IPC pattern (event-based via `event.sender.send()` vs invoke/handle). This touches main process, preload bridge, and renderer -- the most coordination-heavy change. Must guard against destroyed webContents.
3. **Storyboard-timeline sync** -- Bidirectional sync between compose storyboard steps and timeline segments is the highest-complexity UI feature. It needs its own store with explicit loop guards to avoid entangling the existing timeline-store's auto-save subscriber.

### Viable Options

#### Option A: Phased Additive Migration (RECOMMENDED)

Add `compose` and `script` presets alongside `editing`, keep `editing` working until all new views are functional, then remove `editing`, `dual-pane`, and `DualPaneView` in a final cleanup phase.

**Pros:**
- Tests stay green at every phase boundary
- Can ship incremental progress
- Rollback is trivial (revert to `editing` preset)

**Cons:**
- Temporary code duplication while both old and new presets coexist
- `WorkspacePreset` type briefly has 5 values before `editing` is removed

**Mitigation for 5-value type:** `setWorkspacePreset` setter guard maps `'editing'` → `'compose'` at the store level, so the 5th value exists in the type but never persists in state, reducing branch complexity.

#### Option B: Big-Bang Replacement

Replace `editing` with `compose` + `script` in a single phase. Update all tests simultaneously.

**Pros:**
- No temporary duplication
- Cleaner intermediate type (`WorkspacePreset` has 4 values from day one)

**Cons:**
- High risk of cascading test failures across 14+ files
- Cannot ship incrementally
- Harder to bisect regressions

**Invalidation rationale for Option B:** With 472 tests and 14+ files to modify, a big-bang approach creates an unacceptable risk of cascading test failures. The toolbar test (`toolbar-workspace-tabs.test.tsx`) explicitly asserts 3 tabs; the recording-workspace-layout test mocks DualPaneView; add-to-timeline-navigation asserts `'editing'` and `'dual-pane'`. A simultaneous change to all of these makes debugging failures impractical. While Vitest runs fast, the relevant tests span multiple domains (layout, store, IPC), making bisection harder than the Architect's antithesis suggests.

### ADR

- **Decision:** Option A -- Phased Additive Migration
- **Drivers:** Test stability, incremental shippability, rollback safety
- **Alternatives considered:** Big-Bang Replacement (Option B)
- **Why chosen:** The 472-test baseline and cross-cutting nature of preset changes (types, stores, IPC, components, tests) demand incremental migration. Each phase produces a testable, shippable state.
- **Consequences:** Temporary 5-value `WorkspacePreset` union during migration (mitigated by setter guard). `editing` preset maps to `compose` view during transition. Final cleanup phase removes it.
- **Follow-ups:** After migration, audit for any dead code referencing `editing` or `dual-pane`. Update any user documentation. Verify `ProjectStatus = 'editing'` (different concept in `project.ts`) is NOT renamed.

---

## 3. Implementation Phases

### Phase 0: Foundation Types and Store Infrastructure
**Parallelizable:** Yes (all sub-phases independent of each other)
**Dependencies:** None

#### 0A. Extend shared types
**Files to modify:**
- `src/shared/types/ai.ts` -- Add `'codex'` to `AIProviderType` alongside existing `'openai'` (keep both for backward compatibility with existing DB records where `aiBackendUsed = 'openai'`); add `eventIds: string[]`, `actionMarkers: ActionMarker[]`, `freezeOverrideDuration?: number` to `ScriptSection`; add `ActionMarker` and `GenerationLogEntry` types here (AI-domain types)
- `src/shared/types/timeline.ts` -- Add `TransitionType` value `'wipe'` (ensure `TransitionType` is exported)
- `src/shared/types/events.ts` -- Add `StoryboardStep` type (domain entity, fits with existing Clip/Recording types)

**AIProviderType resolution:** `AIProviderType = 'claude' | 'openai' | 'codex' | 'ollama'`. Both `'openai'` and `'codex'` are valid. `CodexProvider` sets `aiBackendUsed: 'codex'` for new scripts. Existing scripts with `'openai'` continue to load correctly. The factory handles both `'openai'` and `'codex'` → `CodexProvider`.

**Acceptance criteria:**
- [ ] `StoryboardStep` type exists in `events.ts` with fields: `id`, `type` (`'intro' | 'step' | 'outro'`), `segmentId` (`string | null`), `eventIds` (`string[]`), `transitionType` (`TransitionType`), `scriptPlaceholder` (`string`), `order` (`number`)
- [ ] `ActionMarker` type exists in `ai.ts` with: `eventId`, `position`, `label`
- [ ] `GenerationLogEntry` type exists in `ai.ts` with: `timestamp`, `level` (`'info' | 'warn' | 'error'`), `message`, `data?`
- [ ] `ScriptSection` has `eventIds: string[]`, `actionMarkers: ActionMarker[]`, `freezeOverrideDuration?: number` (all optional/defaulted)
- [ ] `AIProviderType` is `'claude' | 'openai' | 'codex' | 'ollama'`
- [ ] TypeScript compiles cleanly (`npm run lint`)
- [ ] All 472 tests pass (new optional fields don't break existing code)

#### 0B. Create compose-store
**Files to create:**
- `src/renderer/stores/compose-store.ts`

**Design:**
```
ComposeState {
  steps: StoryboardStep[]
  selectedStepId: string | null
  aiProvider: AIProviderType       // global default
  stepProviderOverrides: Record<string, AIProviderType>  // per-step override
  generationLog: GenerationLogEntry[]
  isGenerating: boolean
  _syncing: boolean                // LOOP GUARD: prevents bidirectional sync loops

  // Actions
  setSteps(steps)
  addStep(step)
  removeStep(id)
  reorderSteps(fromIndex, toIndex)
  updateStep(id, updates)
  setSelectedStep(id | null)
  setAIProvider(provider)
  setStepProviderOverride(stepId, provider)
  clearStepProviderOverride(stepId)
  appendLogEntry(entry)
  clearLog()
  setIsGenerating(bool)

  // Sync (with loop guard)
  syncFromTimeline(segments, domEvents)   // timeline -> storyboard
    // Implementation: if (_syncing) return; set _syncing=true; ... set _syncing=false
  syncToTimeline(): StoryboardStep[]      // storyboard -> timeline
    // Returns current steps array. Caller (compose view) uses this to update
    // timeline-store. The returned value is used by the component, NOT by a
    // direct store-to-store subscription, avoiding the auto-save loop.
}
```

**Sync protocol:**
- `syncFromTimeline`: called when compose view mounts or timeline segments change. Sets `_syncing=true`, creates/updates StoryboardSteps from timeline segments, sets `_syncing=false`. If `_syncing` is already true, returns immediately (prevents loop).
- `syncToTimeline`: pure function that returns the current steps for the caller to apply to timeline-store. Does NOT directly mutate timeline-store. The React component handles the cross-store update, which is naturally gated by React's render cycle.

**State persistence:** Compose-store is **ephemeral** -- steps are re-derived from timeline segments each time the compose view mounts. Intro/outro steps that have no backing segment are stored as SyncPoints (type: 'annotation') on the timeline, ensuring they survive preset switches.

**Acceptance criteria:**
- [ ] Store uses `zustand` with `temporal` (zundo) for undo/redo
- [ ] `_syncing` flag prevents bidirectional update loops
- [ ] `reorderSteps` updates `order` fields consistently
- [ ] `syncFromTimeline` creates StoryboardSteps from timeline segments, respects `_syncing` guard
- [ ] `syncToTimeline` returns steps without directly mutating timeline-store
- [ ] Unit tests cover: add/remove/reorder steps, provider override, log append/clear, sync guard
- [ ] At least 10 new unit tests

#### 0C. Extend script-store
**Files to modify:**
- `src/renderer/stores/script-store.ts`

**Changes:**
- Add `assignEventToSection(sectionId: string, eventId: string)` action
- Add `removeEventFromSection(sectionId: string, eventId: string)` action
- Add `setFreezeOverride(sectionId: string, duration: number | null)` action

**Acceptance criteria:**
- [ ] New actions work correctly in unit tests
- [ ] Existing `script-store.test.ts` and `script-store-clip-scripts.test.ts` still pass
- [ ] At least 4 new unit tests for event assignment and freeze override

#### 0D. Update `WorkspacePreset` type (additive only)
**Files to modify:**
- `src/renderer/stores/ui-store.ts`

**Changes:**
- `WorkspacePreset = 'recording' | 'compose' | 'script' | 'export' | 'editing'` (keep `editing` temporarily)
- **DO NOT** remove `'dual-pane'` from `EditorView` -- keep `EditorView = 'script-only' | 'dual-pane' | 'inline'` unchanged until Phase 6
- **DO NOT** change default `editorView` -- keep `'dual-pane'` as default until Phase 6
- Default `workspacePreset` changes from `'editing'` to `'compose'`
- Add setter guard: `setWorkspacePreset: (preset) => set({ workspacePreset: preset === 'editing' ? 'compose' : preset })` -- this ensures `'editing'` never persists in state

**Acceptance criteria:**
- [ ] TypeScript compiles
- [ ] `EditorView` still includes `'dual-pane'` (no removal yet)
- [ ] `setWorkspacePreset('editing')` results in state being `'compose'`
- [ ] All 472 tests pass with NO test modifications needed (additive change only)

#### 0E. DB migration for ScriptSection fields
**Files to modify:**
- `src/main/services/project-store.ts` -- Add migration in DB initialization to add columns to `script_sections` table

**SQL migration:**
```sql
ALTER TABLE script_sections ADD COLUMN event_ids TEXT DEFAULT '[]';
ALTER TABLE script_sections ADD COLUMN action_markers TEXT DEFAULT '[]';
ALTER TABLE script_sections ADD COLUMN freeze_override_duration REAL DEFAULT NULL;
```

**Acceptance criteria:**
- [ ] Migration runs on app startup (idempotent -- check if columns exist first)
- [ ] Existing script sections load correctly with default values for new fields
- [ ] New fields are serialized/deserialized correctly (JSON for arrays)
- [ ] At least 2 integration tests: migration runs cleanly, existing data survives

---

### Phase 1: AI Backend (Streaming + Codex Provider + Error Handling)
**Parallelizable:** Yes (independent of UI work in Phase 2)
**Dependencies:** Phase 0A (types)

#### 1A. Extend IAIProvider with streaming
**Files to modify:**
- `src/shared/interfaces/ai-provider.ts` -- Add optional `generateScriptStream?(prompt, context, onChunk): Promise<Script>` method

**Acceptance criteria:**
- [ ] `generateScriptStream` is optional (existing providers don't break)
- [ ] `onChunk` callback type: `(chunk: string) => void`
- [ ] All existing AI provider tests pass

#### 1B. Add streaming to CLI runner
**Files to modify:**
- `src/main/services/ai/cli-runner.ts` -- Add `runCLIStreaming(binary, args, stdinData, onStdout, timeoutMs)` that calls `onStdout` per line/chunk

**Acceptance criteria:**
- [ ] New function emits chunks via callback as stdout data arrives
- [ ] Timeout and error handling match existing `runCLI`
- [ ] Unit test confirms streaming callback fires per data event

#### 1C. Create codex-provider
**Files to create:**
- `src/main/services/ai/codex-provider.ts`

**Files to modify:**
- `src/main/services/ai/index.ts` -- Update `createAIProvider` factory: `case 'codex'` AND `case 'openai'` both instantiate `CodexProvider`

**Design:** Create NEW `CodexProvider` class in `codex-provider.ts`. The existing `openai-provider.ts` remains unchanged (backward compat). `CodexProvider` implements `IAIProvider` with `generateScriptStream` using `codex` CLI binary via `runCLIStreaming`. The factory maps both `'openai'` and `'codex'` to `CodexProvider` -- existing scripts with `aiBackendUsed: 'openai'` continue to work.

**Acceptance criteria:**
- [ ] `CodexProvider` implements `IAIProvider` with `generateScriptStream`
- [ ] Provider name is `'codex'`
- [ ] `createAIProvider` factory handles both `'codex'` and `'openai'` cases → `CodexProvider`
- [ ] `src/main/services/ai/index.ts` is updated
- [ ] Unit tests for codex provider (at least 3 tests)

#### 1D. Add streaming support to claude-provider and ollama-provider
**Files to modify:**
- `src/main/services/ai/claude-provider.ts` -- Add `generateScriptStream` using `runCLIStreaming`
- `src/main/services/ai/ollama-provider.ts` -- Add `generateScriptStream` using Ollama streaming API (`stream: true`)

**Acceptance criteria:**
- [ ] Both providers implement `generateScriptStream`
- [ ] Ollama uses `stream: true` and processes NDJSON chunks
- [ ] Claude uses `runCLIStreaming` with line-buffered output
- [ ] Existing non-streaming tests still pass

#### 1E. Streaming IPC channel + error detail
**Files to modify:**
- `src/shared/constants.ts` -- Add `AI_GENERATE_SCRIPT_STREAM`, `AI_STREAM_CHUNK`, `AI_STREAM_DONE`, `AI_STREAM_ERROR` channel constants
- `src/main/ipc/ai.ipc.ts` -- Add streaming IPC handler using `event.sender.send()` for chunk events. **CRITICAL: guard every `event.sender.send()` call with `if (!event.sender.isDestroyed())`** since the webContents may be destroyed mid-stream. Include detailed error info in error events.
- `src/preload/index.ts` -- Add `ai.generateScriptStream(args)` invoke + `ai.onStreamChunk(cb)` / `ai.onStreamDone(cb)` / `ai.onStreamError(cb)` listeners + `ai.removeStreamListeners()`

**Error detail format:**
```typescript
{
  error: string           // Human-readable error message
  provider: string        // 'claude' | 'codex' | 'ollama'
  model: string           // Model name used
  promptPreview: string   // First 500 chars of prompt
  fullPrompt: string      // Full prompt (for copy-paste debugging)
  stack?: string          // Stack trace if available
  timestamp: number       // When the error occurred
}
```

**Acceptance criteria:**
- [ ] Streaming IPC roundtrip works: renderer invokes, main streams chunks via sender.send, renderer receives via onStreamChunk
- [ ] Every `event.sender.send()` guarded with `!event.sender.isDestroyed()` check
- [ ] Error responses include full detail format above
- [ ] `removeStreamListeners` properly cleans up all `ipcRenderer.on` listeners
- [ ] React components calling `ai.onStreamChunk` **MUST** call `ai.removeStreamListeners()` in a `useEffect` cleanup return
- [ ] At least 5 new tests covering streaming IPC, error detail, and listener cleanup

#### 1F. Update prompt templates for [ACTION:...] markers
**Files to modify:**
- `src/main/services/ai/prompt-templates.ts` -- Update system prompt to instruct AI to emit `[ACTION: eventId "description"]` markers referencing specific DOM events
- `src/main/services/ai/script-parser.ts` -- Add `[ACTION: ...]` regex parser alongside existing `[PAUSE]`, `[FREEZE]`, etc.

**Acceptance criteria:**
- [ ] System prompt includes ACTION marker documentation
- [ ] `extractTimingMarkers` parses `[ACTION: evt123 "Click submit"]` into `ActionMarker` objects
- [ ] Existing parser tests still pass
- [ ] At least 3 new parser tests for ACTION markers

---

### Phase 2: Compose View (Storyboard + Timeline Sync)
**Parallelizable:** Yes (runs in parallel with Phase 1 after Phase 0)
**Dependencies:** Phase 0 (all sub-phases)

**Pre-requisite:** Verify `@dnd-kit/sortable@^10.0.0` is compatible with `@dnd-kit/core@^6.3.1`. If incompatible, upgrade `@dnd-kit/core` to match. Run `npm ls @dnd-kit/core @dnd-kit/sortable` to check resolved versions.

**DnD architecture:** Use a SINGLE `DndContext` wrapping the entire StoryboardPanel. Distinguish drag types via `data` property on draggable items:
- Step reorder drags: `data: { type: 'step-reorder', stepId: string }`
- Event chip drags: `data: { type: 'event-chip', eventId: string }`
- `onDragEnd` handler inspects `active.data.current.type` to dispatch to the correct action (reorder vs assign event)

#### 2A. StepCard component
**Files to create:**
- `src/renderer/components/compose/StepCard.tsx`

**Design:** A card displaying:
- Step type badge (intro/step/outro) with colored indicator
- Clip segment thumbnail (via existing `clip.getThumbnails`)
- DOM event chips (assigned events shown inside card, card is a drop target for `type: 'event-chip'` drags)
- Transition selector dropdown (cut/fade/dissolve/wipe)
- Script narration placeholder text
- AI provider override dropdown (optional, inherits global default)
- Drag handle for @dnd-kit/sortable reordering (handle has `data: { type: 'step-reorder' }`)

**Acceptance criteria:**
- [ ] Renders step type, thumbnail area, event chips, transition selector
- [ ] @dnd-kit/sortable integration for reordering via drag handle
- [ ] DOM event chips are drop targets (accept `type: 'event-chip'` drags only, not `type: 'step-reorder'`)
- [ ] Provider override dropdown shows available providers
- [ ] At least 6 unit tests (render, reorder, transition change, event drop, event remove)

#### 2B. StoryboardPanel component
**Files to create:**
- `src/renderer/components/compose/StoryboardPanel.tsx`

**Design:**
- Single `DndContext` + `SortableContext` wrapping vertical list of StepCards
- `onDragEnd` dispatches based on `active.data.current.type`: `'step-reorder'` → compose-store.reorderSteps, `'event-chip'` → compose-store.updateStep (add eventId)
- "Add Intro" / "Add Outro" buttons
- Auto-generates steps from timeline segments via `compose-store.syncFromTimeline` on mount
- Reordering steps calls `compose-store.syncToTimeline()` and applies result to timeline-store

**Acceptance criteria:**
- [ ] Renders list of StepCards from compose-store
- [ ] Single DndContext handles both step reorder and event chip drops
- [ ] Drag-and-drop reorder updates compose-store and triggers timeline sync
- [ ] "Add Intro" creates a step with type `'intro'` at position 0
- [ ] "Add Outro" creates a step with type `'outro'` at last position
- [ ] At least 6 unit tests

#### 2C. ComposeView container
**Files to create:**
- `src/renderer/components/compose/ComposeView.tsx`

**Layout:** Storyboard panel (left, ~40%) + Preview panel (right, ~60%) with ResizeDivider (same pattern as PanelSystem's sidebar resize: mousedown → mousemove tracking → width update). Timeline visible at bottom (shared existing timeline component).

**Acceptance criteria:**
- [ ] Renders StoryboardPanel and PlaybackPanel side by side
- [ ] Resizable split via mousedown/mousemove pattern (matching existing PanelSystem)
- [ ] Timeline section visible at bottom
- [ ] At least 3 unit tests (render, layout, resize)

#### 2D. DOM event chips (draggable)
**Files to create:**
- `src/renderer/components/compose/EventChip.tsx` -- draggable chip with `data: { type: 'event-chip', eventId }` showing event type icon + truncated elementText/selector

**Acceptance criteria:**
- [ ] EventChip renders event type icon and label
- [ ] Draggable with `data.type = 'event-chip'`
- [ ] A chip assigned to a step shows inside the StepCard
- [ ] Removing a chip from a step removes it from eventIds
- [ ] At least 4 unit tests

---

### Phase 3: Script View + Operation Log
**Dependencies:** Phase 0 (types, stores), Phase 1E (streaming IPC for OperationLog only)
**Note:** Phase 3A (ScriptPresetView) does NOT depend on Phase 1E -- only Phase 3B (OperationLog) does. 3A can start as soon as Phase 0 completes.

#### 3A. ScriptPresetView layout
**Files to create:**
- `src/renderer/components/script-view/ScriptPresetView.tsx`

**Layout:** Script editor (left pane, Tiptap) + Video preview (right pane, PlaybackPanel) + Timeline (bottom). Replaces DualPaneView's role as a full preset layout. Uses same ResizeDivider mousedown/mousemove pattern as PanelSystem.

**Acceptance criteria:**
- [ ] Renders Tiptap editor with script content on left
- [ ] Renders PlaybackPanel on right
- [ ] Timeline at bottom (existing Timeline component)
- [ ] Resizable panes via mousedown/mousemove pattern
- [ ] At least 3 unit tests

#### 3B. OperationLog component (streaming display)
**Files to create:**
- `src/renderer/components/script-view/OperationLog.tsx`

**Dependencies:** Phase 1E (streaming IPC)

**Design:** Collapsible panel showing `GenerationLogEntry[]` from compose-store. During generation:
- Subscribes to stream via `window.leonardo.ai.onStreamChunk()` etc.
- **CRITICAL:** Cleans up listeners in `useEffect` return: `return () => window.leonardo.ai.removeStreamListeners()`
- Shows elapsed time, color-coded by level (info=neutral, warn=yellow, error=red)
- Persists after completion (not auto-cleared)
- Copy-all button

**Acceptance criteria:**
- [ ] Renders log entries from compose-store.generationLog
- [ ] Collapsible (toggle open/closed)
- [ ] Real-time updates as new entries are appended
- [ ] Copy-all button copies log text to clipboard
- [ ] `useEffect` cleanup calls `removeStreamListeners()`
- [ ] At least 5 unit tests

#### 3C. ErrorLog component
**Files to create:**
- `src/renderer/components/script-view/ErrorLog.tsx`

**Design:** Displays AI invocation errors with full detail for external debugging:
- Provider name, model, timestamp
- Full error message
- Full prompt text (for pasting into another AI to debug)
- Stack trace (if available)
- Single "Copy Error Report" button that copies formatted block: `[Provider: claude] [Model: ...] [Error: ...] [Prompt: ...] [Stack: ...]`

**Acceptance criteria:**
- [ ] Renders all error detail fields
- [ ] Copy button copies formatted error block to clipboard (suitable for pasting into another AI)
- [ ] DaVinci Resolve dark theme styling (red accent for errors)
- [ ] At least 3 unit tests

---

### Phase 4: Wire Presets into Layout System
**Parallelizable:** No (depends on Phases 2 and 3)
**Dependencies:** Phase 0D (preset types), Phase 2C (ComposeView), Phase 3A (ScriptPresetView)

#### 4A. Update Toolbar
**Files to modify:**
- `src/renderer/components/layout/Toolbar.tsx`

**Changes:**
- `WORKSPACE_TABS` becomes 4 entries: `recording` ("Record"), `compose` ("Compose"), `script` ("Script"), `export` ("Export")
- ViewModeToggle is only shown for `compose` preset (or hidden entirely -- the Script preset IS the script view)
- If `editing` preset is still referenced anywhere, the setter guard maps it to `compose`

**Acceptance criteria:**
- [ ] 4 tab buttons render with correct labels
- [ ] Clicking each tab updates `workspacePreset` in ui-store
- [ ] Active tab has `workspace-tab-active` class
- [ ] Tests updated: `toolbar-workspace-tabs.test.tsx` (expects 4 tabs, tests `compose` active state)
- [ ] All tests pass

#### 4B. Update PanelSystem
**Files to modify:**
- `src/renderer/components/layout/PanelSystem.tsx`

**Changes:**
- Add `ComposeView` and `ScriptPresetView` imports
- Routing logic (keep DualPaneView import and `'dual-pane'` branch alive until Phase 6):
  - `preset === 'recording'` → RecordingBrowser (unchanged)
  - `preset === 'compose'` → ComposeView
  - `preset === 'script'` → ScriptPresetView
  - `preset === 'export'` → PlaybackPanel (unchanged)
  - `preset === 'editing'` → ComposeView (backward compat, but setter guard means this rarely triggers)
- Timeline panel: visible for compose, script, export (not recording)

**Acceptance criteria:**
- [ ] Each preset renders the correct view
- [ ] DualPaneView still works for `editorView === 'dual-pane'` (not removed yet)
- [ ] Timeline visibility rules correct per preset
- [ ] `recording-workspace-layout.test.tsx` still passes (no changes needed -- additive)
- [ ] At least 4 new integration tests for compose and script layout

#### 4C. Update Workspace + RecordingControls
**Files to modify:**
- `src/renderer/components/layout/Workspace.tsx` -- Initialize compose-store when project becomes active (call `syncFromTimeline`)
- `src/renderer/components/browser/RecordingControls.tsx` -- Change `setWorkspacePreset('editing')` to `setWorkspacePreset('compose')` in "Edit Now" handler (line ~178)

**Acceptance criteria:**
- [ ] Compose store syncs from timeline when project loads
- [ ] Switching presets preserves state correctly
- [ ] "Edit Now" button navigates to compose preset (not stale `'editing'`)

---

### Phase 5: Auto Freeze-Frame + WPM Calculation
**Parallelizable:** Yes (independent of UI phases, can run parallel with Phase 4)
**Dependencies:** Phase 0A (types), Phase 1F (ACTION markers)

#### 5A. Freeze-frame calculator
**Files to create:**
- `src/main/services/ai/freeze-frame-calculator.ts`

**Design:**
- Input: script section text, DOM events assigned to section, section time range
- Calculate narration duration: `wordCount / WPM * 60` (default WPM = 150, configurable)
- Calculate event gap: time between last event in section and section end time
- If narration duration > event gap: freeze needed, duration = narration duration - event gap (rounded to 0.5s)
- If `freezeOverrideDuration` is set on section, use that instead of calculated value
- Returns: `{ needed: boolean, duration: number, calculated: number, overridden: boolean }`

**Acceptance criteria:**
- [ ] Correctly calculates freeze duration for narration > event gap
- [ ] Returns `needed: false` when narration fits within event gap
- [ ] Respects user override duration (`overridden: true`)
- [ ] Configurable WPM (default 150)
- [ ] Pure function, no side effects
- [ ] At least 8 unit tests with different text lengths, event timings, and override scenarios

---

### Phase 6: Cleanup and Final Migration
**Parallelizable:** No (final sequential phase)
**Dependencies:** All previous phases complete and tests passing

#### 6A. Remove DualPaneView, `'editing'` preset, and `'dual-pane'` EditorView
**Files to delete:**
- `src/renderer/components/script-editor/DualPaneView.tsx`

**Files to modify:**
- `src/renderer/stores/ui-store.ts` -- Remove `'editing'` from `WorkspacePreset`; remove `'dual-pane'` from `EditorView`; change default `editorView` from `'dual-pane'` to `'inline'`; remove setter guard for `'editing'`
- `src/renderer/components/layout/PanelSystem.tsx` -- Remove DualPaneView import and `'dual-pane'` rendering branch; remove `'editing'` → ComposeView mapping
- `src/renderer/components/layout/ViewModeToggle.tsx` -- Remove `'dual-pane'` entry from view list
- `src/renderer/styles/globals.css` -- Remove `.dual-pane-view`, `.dual-pane-left`, `.dual-pane-right` CSS rules

**Test files to update:**
- `tests/unit/toolbar-workspace-tabs.test.tsx` -- Remove any remaining `'editing'` references
- `tests/integration/view-mode-switching.test.tsx` -- Remove `'dual-pane'` test cases, update assertions
- `tests/integration/recording-workspace-layout.test.tsx` -- Remove DualPaneView mock
- `tests/integration/add-to-timeline-navigation.test.tsx` -- Change `'editing'` to `'compose'`, change `'dual-pane'` to `'inline'`
- `tests/unit/workspace-load-scripts.test.tsx` -- Change `mockWorkspacePreset = 'editing'` to `'compose'`

**Acceptance criteria:**
- [ ] No file in the project imports `DualPaneView`
- [ ] `WorkspacePreset` type is exactly `'recording' | 'compose' | 'script' | 'export'`
- [ ] `EditorView` type is exactly `'script-only' | 'inline'`
- [ ] No test references `'editing'` or `'dual-pane'` as valid values
- [ ] `ProjectStatus = 'editing'` in `project.ts` is NOT changed (different concept)
- [ ] `npm run lint` passes (no type errors)
- [ ] All tests pass (target: 472 + ~60 new = ~530+ tests)

#### 6B. Verify full integration
**Acceptance criteria:**
- [ ] `npm test` -- all tests pass
- [ ] `npm run lint` -- no type errors
- [ ] Manual smoke test: Record → Compose (storyboard visible, reorderable) → Script (editor + preview + timeline) → Export
- [ ] Streaming script generation shows real-time log
- [ ] AI error displays with copy-to-clipboard (suitable for external AI debugging)
- [ ] Freeze-frame markers inserted when narration exceeds event gap
- [ ] Provider override dropdown functional in both compose and script views

---

## 4. Acceptance Criteria (Full List)

### From Spec (13 criteria):
1. [Phase 4A] Toolbar shows 4 presets: Recording, Compose, Script, Export
2. [Phase 2] Compose view: storyboard panel with reorderable step cards synced with timeline
3. [Phase 2A] Step cards show: clip segment, DOM event chips, transition selector, script placeholder
4. [Phase 3A] Script view layout: editor (left) + preview (right) + timeline (bottom)
5. [Phase 6A] DualPaneView removed
6. [Phase 2D] DOM events are draggable chips assignable to script sections
7. [Phase 1F] Per-step scripts contain [ACTION: ...] markers
8. [Phase 0B, 2A] AI backend selector: global default + per-step override
9. [Phase 1A, 1D] Unified IAIProvider with streaming
10. [Phase 3B] Real-time streaming operation log
11. [Phase 5A] Auto freeze-frame with WPM calculation + user override
12. [Phase 3C] AI error log with copy-paste for external debugging
13. [Phase 6B] All existing tests pass

### Implementation-specific criteria:
14. compose-store with temporal (zundo) undo/redo and `_syncing` loop guard
15. @dnd-kit: single DndContext with `data` type discriminator for step reorder vs event chip
16. IPC streaming: `event.sender.isDestroyed()` guard on every `sender.send()` call
17. React lifecycle: `useEffect` cleanup for stream listeners
18. CodexProvider using `codex` CLI binary; factory maps both `'openai'` and `'codex'`
19. DB migration for new ScriptSection fields (event_ids, action_markers, freeze_override_duration)
20. Backward compatibility: `setWorkspacePreset('editing')` maps to `'compose'`
21. DaVinci Resolve dark theme on all new components
22. At least 60 new tests across all phases (target: 530+ total)

---

## 5. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Test cascade from `WorkspacePreset` change | HIGH | HIGH | Phase 0D ONLY adds values, never removes. `'editing'` and `'dual-pane'` kept until Phase 6. Setter guard maps `'editing'` → `'compose'`. |
| Streaming IPC memory leak / crash on destroyed webContents | MEDIUM | HIGH | `event.sender.isDestroyed()` guard on every `sender.send()`. `removeStreamListeners()` cleanup. `useEffect` return cleanup in React components. |
| Storyboard-timeline sync loop | MEDIUM | HIGH | `_syncing` boolean guard in compose-store. `syncToTimeline` returns data instead of directly mutating timeline-store. Timeline auto-save debounce (1s) dampens rapid changes. |
| @dnd-kit version incompatibility (core@6 + sortable@10) | MEDIUM | MEDIUM | Pre-Phase 2 check: `npm ls @dnd-kit/core @dnd-kit/sortable`. If incompatible, upgrade core. |
| Nested DnD confusion (step reorder vs chip drop) | MEDIUM | MEDIUM | Single DndContext with `data.type` discriminator. `onDragEnd` handler dispatches based on `active.data.current.type`. |
| Codex CLI not installed on user machine | LOW | LOW | `isCLIAvailable` check. UI shows "not available" state. `testConnection` catches ENOENT. |
| DB migration failure on existing data | LOW | MEDIUM | Migration is additive (ALTER TABLE ADD COLUMN with defaults). Idempotent check before running. |
| Freeze-frame WPM inaccuracy | LOW | LOW | Configurable WPM default. User can override per-section. Visual indicator in UI. |
| `ProjectStatus = 'editing'` accidentally renamed | LOW | HIGH | Phase 6 acceptance criteria explicitly state this must NOT be changed. Grep verification step. |

---

## 6. Verification Steps

### Per-phase verification:
- After each phase: `npm test` (all existing + new tests pass), `npm run lint` (no type errors)
- Phase 0: verify additive-only changes, no test breakage
- Phase 2 pre-check: verify @dnd-kit version compatibility

### Final verification:
1. `npm test` -- 530+ tests pass, 0 failures
2. `npm run lint` -- clean typecheck
3. `grep -r "'editing'" src/` -- only `ProjectStatus` and comments, no `WorkspacePreset` references
4. `grep -r "'dual-pane'" src/` -- zero matches
5. `grep -r "DualPaneView" src/` -- zero matches
6. Manual flow: Create project → Record → Switch to Compose → Verify storyboard auto-populates from timeline segments → Reorder steps → Switch to Script → Verify script editor + preview layout → Generate script (verify streaming log) → Force an AI error (invalid config) → Verify error log with copy button → Check freeze-frame markers on long narration sections → Switch to Export

### Test coverage targets:
| Area | Tests | Phase |
|------|-------|-------|
| compose-store | 10+ | 0B |
| script-store extensions | 4+ | 0C |
| DB migration | 2+ | 0E |
| StepCard | 6+ | 2A |
| StoryboardPanel | 6+ | 2B |
| ComposeView | 3+ | 2C |
| EventChip | 4+ | 2D |
| ScriptPresetView | 3+ | 3A |
| OperationLog | 5+ | 3B |
| ErrorLog | 3+ | 3C |
| CodexProvider | 3+ | 1C |
| Streaming IPC | 5+ | 1E |
| Freeze-frame calculator | 8+ | 5A |
| ACTION marker parser | 3+ | 1F |
| Toolbar (updated) | update existing | 4A |
| PanelSystem (updated) | 4+ new | 4B |
| **Total new tests** | **~65+** | |

---

## 7. Phase Dependency Graph

```
Phase 0 (Foundation)
  ├── 0A: Types           ─┐
  ├── 0B: Compose Store    │── all independent, run in parallel
  ├── 0C: Script Store     │
  ├── 0D: UI Store Types   │
  └── 0E: DB Migration    ─┘
          │
          ├─────────────────────────┐
          ▼                         ▼
Phase 1 (AI Backend)          Phase 2 (Compose View)
  ├── 1A: IAIProvider stream    ├── 2A: StepCard
  ├── 1B: CLI streaming         ├── 2B: StoryboardPanel
  ├── 1C: CodexProvider         ├── 2C: ComposeView
  ├── 1D: Provider streaming    └── 2D: EventChips
  ├── 1E: Streaming IPC
  └── 1F: ACTION markers
          │
          ├─ Phase 3A can start after Phase 0 ─┐
          ▼                                     │
Phase 3 (Script View)                           │
  ├── 3A: ScriptPresetView (needs Phase 0 only)│
  ├── 3B: OperationLog (needs Phase 1E)        │
  └── 3C: ErrorLog (needs Phase 1E)            │
          │                                     │
          ├─────────────────────────────────────┘
          ▼
Phase 4 (Wire Presets) -- needs Phases 2C + 3A
  ├── 4A: Toolbar
  ├── 4B: PanelSystem
  └── 4C: Workspace + RecordingControls
          │
          ▼
Phase 5 (Freeze-Frame) ←── can run parallel with Phase 4
          │
          ▼
Phase 6 (Cleanup) -- needs all previous phases
  ├── 6A: Remove DualPaneView + editing + dual-pane
  └── 6B: Final verification
```

**Parallel execution opportunities:**
- Phase 0: All sub-phases (0A-0E) in parallel
- Phase 1 + Phase 2: Run in parallel after Phase 0
- Phase 3A: Can start after Phase 0 (before Phase 1 completes)
- Phase 3B/3C: Wait for Phase 1E
- Phase 5: Run parallel with Phase 4
- Phase 6: Sequential, after everything else

---

## 8. Files Summary

### Files to Create (11):
1. `src/renderer/stores/compose-store.ts`
2. `src/renderer/components/compose/ComposeView.tsx`
3. `src/renderer/components/compose/StoryboardPanel.tsx`
4. `src/renderer/components/compose/StepCard.tsx`
5. `src/renderer/components/compose/EventChip.tsx`
6. `src/renderer/components/script-view/ScriptPresetView.tsx`
7. `src/renderer/components/script-view/OperationLog.tsx`
8. `src/renderer/components/script-view/ErrorLog.tsx`
9. `src/main/services/ai/codex-provider.ts`
10. `src/main/services/ai/freeze-frame-calculator.ts`
11. (test files listed separately below)

### Files to Modify (20):
1. `src/shared/types/ai.ts` (0A)
2. `src/shared/types/events.ts` (0A)
3. `src/shared/types/timeline.ts` (0A)
4. `src/shared/interfaces/ai-provider.ts` (1A)
5. `src/shared/constants.ts` (1E)
6. `src/renderer/stores/ui-store.ts` (0D, 6A)
7. `src/renderer/stores/script-store.ts` (0C)
8. `src/renderer/components/layout/Toolbar.tsx` (4A)
9. `src/renderer/components/layout/PanelSystem.tsx` (4B, 6A)
10. `src/renderer/components/layout/Workspace.tsx` (4C)
11. `src/renderer/components/layout/ViewModeToggle.tsx` (6A)
12. `src/renderer/components/browser/RecordingControls.tsx` (4C)
13. `src/renderer/styles/globals.css` (6A)
14. `src/main/services/ai/index.ts` (1C)
15. `src/main/services/ai/claude-provider.ts` (1D)
16. `src/main/services/ai/ollama-provider.ts` (1D)
17. `src/main/services/ai/cli-runner.ts` (1B)
18. `src/main/services/ai/prompt-templates.ts` (1F)
19. `src/main/services/ai/script-parser.ts` (1F)
20. `src/main/ipc/ai.ipc.ts` (1E)
21. `src/preload/index.ts` (1E)
22. `src/main/services/project-store.ts` (0E)

### Files to Delete (1):
1. `src/renderer/components/script-editor/DualPaneView.tsx` (Phase 6A)

### Test Files to Create (~13):
1. `tests/unit/compose-store.test.ts`
2. `tests/unit/step-card.test.tsx`
3. `tests/unit/storyboard-panel.test.tsx`
4. `tests/unit/event-chip.test.tsx`
5. `tests/unit/compose-view.test.tsx`
6. `tests/unit/script-preset-view.test.tsx`
7. `tests/unit/operation-log.test.tsx`
8. `tests/unit/error-log.test.tsx`
9. `tests/unit/codex-provider.test.ts`
10. `tests/unit/freeze-frame-calculator.test.ts`
11. `tests/unit/action-marker-parser.test.ts`
12. `tests/unit/streaming-ipc.test.ts`
13. `tests/integration/db-migration-script-sections.test.ts`

### Test Files to Modify (7):
1. `tests/unit/toolbar-workspace-tabs.test.tsx` (4A, 6A)
2. `tests/integration/view-mode-switching.test.tsx` (6A)
3. `tests/integration/recording-workspace-layout.test.tsx` (6A)
4. `tests/integration/add-to-timeline-navigation.test.tsx` (6A)
5. `tests/unit/workspace-load-scripts.test.tsx` (6A)
6. `tests/unit/ai-provider-factory.test.ts` (1C)
7. `tests/unit/prompt-templates.test.ts` (1F)

---

## 9. Revision Changelog

### R2 (2026-04-12) -- Architect + Critic feedback

| # | Issue | Source | Resolution |
|---|-------|--------|------------|
| 1 | Phase 0D removes `'dual-pane'` prematurely | Architect + Critic | Deferred to Phase 6. Phase 0D is now additive-only. |
| 2 | `AIProviderType` naming confusion (`'openai'` vs `'codex'`) | Critic (CRITICAL) | Keep both in union type. Factory maps both to CodexProvider. Existing DB records with `'openai'` work. |
| 3 | Missing `_syncing` guard in compose-store spec | Architect | Added to store design with protocol documentation. |
| 4 | Nested @dnd-kit architecture unspecified | Architect | Single DndContext with `data.type` discriminator. |
| 5 | `event.sender.send()` not guarded against destroyed webContents | Architect | Added `isDestroyed()` guard requirement to Phase 1E. |
| 6 | React lifecycle cleanup for stream listeners unspecified | Architect | Added `useEffect` cleanup requirement to Phase 1E and 3B. |
| 7 | Missing RecordingControls.tsx from file list | Critic (MAJOR) | Added to Phase 4C. |
| 8 | Missing workspace-load-scripts.test.tsx from test list | Critic (MAJOR) | Added to Phase 6A test list. |
| 9 | Missing DB migration for new ScriptSection fields | Critic (MAJOR) | Added Phase 0E with SQLite ALTER TABLE migration. |
| 10 | @dnd-kit version compatibility concern | Critic (MAJOR) | Added pre-Phase 2 verification step. |
| 11 | File count discrepancy (15 vs 19) | Critic (minor) | Fixed: 22 files to modify (accurate count). |
| 12 | ActionMarker/GenerationLogEntry in wrong type file | Critic (minor) | Moved to `ai.ts` (AI-domain types). |
| 13 | syncToTimeline semantics unclear | Critic | Documented: returns steps array, does not directly mutate timeline-store. |
| 14 | Compose-store persistence unclear | Critic | Documented: ephemeral, re-derived from timeline on mount. |
| 15 | `ProjectStatus = 'editing'` could be accidentally renamed | Critic | Added explicit acceptance criterion in Phase 6A to NOT change it. |
