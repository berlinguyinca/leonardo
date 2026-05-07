# Implementation Plan: Compose Playback Fixes + Effects Preset

**Source Spec:** `.omc/specs/deep-interview-compose-playback-effects.md`
**Status:** REVISED v2 — Architect + Critic ITERATE feedback incorporated

---

## RALPLAN-DR Summary

### Principles
1. **TDD-first for bugs** — write failing tests that prove the bug, then fix, then verify
2. **Minimal blast radius** — fix bugs with surgical changes to existing files; don't refactor working code
3. **Single source of truth** — overlay persistent data embeds in Segment.metadata (not a separate store), gaining free undo/redo, cascade delete, and auto-save
4. **Progressive delivery** — each phase is independently shippable and testable
5. **Existing patterns** — follow established Zustand + emitter + PanelSystem + SQLite conventions

### Decision Drivers
1. **Playback reliability** — spacebar/arrows must work 100% of the time (user's #1 priority)
2. **Data integrity** — overlay data must participate in undo/redo, cascade delete, and auto-save without new coordination logic
3. **Test coverage** — full TDD for bugs, unit+integration+E2E for features (user mandated E2E with Playwright)

### Viable Options

**Option A: Incremental phases + embedded metadata (CHOSEN)**
- Overlay persistent data stored in `Segment.metadata` field — undo/redo via zundo, cascade delete via existing `removeSegment`, auto-save via existing subscriber
- Separate `overlay-editor-store.ts` for UI-only state (selected element, editor mode)
- Pros: single source of truth, zero new lifecycle coordination, free undo/redo coverage
- Cons: `Segment` type becomes slightly fatter with optional `metadata` field

**Option B: Separate overlay-store with cascade hooks**
- Dedicated `overlay-store.ts` keyed by segmentId for all overlay data
- Must add cascade hooks to `removeSegment`, `removeSegmentsBySourceFile`, `removeTrack`, and wire into zundo temporal
- **Invalidated because**: creates distributed data problem — two stores must stay in sync for every lifecycle operation (create/delete/undo/redo/save). The codebase's existing single-store + auto-save pattern is simpler.

**Option C: Feature-branch parallel**
- Bugs in one branch, effects preset in another, merge at end
- **Invalidated because**: timeline-store.ts and PanelSystem.tsx are modified by both tracks, creating guaranteed merge conflicts

---

## Phase 1: Playback Bug Fixes (TDD)

### Step 1.1: Spacebar Focus Bug — Failing Test

**Analysis:** `useUndoRedo.ts:33` handles space on `window.keydown` and calls `e.preventDefault()`. However, when a `<button>` element is focused (e.g., transport controls), the browser activates buttons on `keyup` — `preventDefault()` on `keydown` does NOT prevent this. Result: if the play button is focused, space triggers both the button click AND the global handler, causing a double-toggle (play→pause→play = stuck).

**File:** `tests/unit/spacebar-focus.test.tsx` (new)
- Test: space toggles play when timeline container is focused
- Test: space toggles play when a transport button is focused (NOT double-toggle)
- Test: space toggles play when properties panel is focused
- Test: space does NOT toggle when an input/textarea is focused

### Step 1.2: Spacebar Focus Bug — Fix

**File to modify:** `src/renderer/hooks/useUndoRedo.ts`

**Fix:** Add a `keyup` handler alongside the `keydown` handler. On `keyup` for space, call `e.preventDefault()` to suppress the browser's button activation from `keyup`. This ensures the global handler fires exactly once on `keydown`, and the `keyup` prevents the focused button from also firing a `click` event.

```typescript
const handleKeyUp = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  if (e.key === ' ' && !isInput) {
    e.preventDefault() // prevent button activation from keyup
  }
}
window.addEventListener('keyup', handleKeyUp)
// cleanup: window.removeEventListener('keyup', handleKeyUp)
```

### Step 1.3: Arrow Key Preview Update Bug — Failing Test

**Analysis (revised per Architect review):** Arrow keys in `Timeline.tsx:111-127` call `s.setIsPlaying(false)`, then `s.setPlayheadPosition(newPos)`, then `playheadEmitter.emit('position', newPos)`.

The Zustand store updates are synchronous, so `PlaybackPanel` should pick up the new `storePosition` via its subscription `useTimelineStore((s) => s.playheadPosition)`. When paused, `effectivePosition = storePosition` (line 55), which flows to `activeSegment → videoTimeMs → VideoPlayer.currentTime`.

**Primary suspect: VideoPlayer 50ms debounce** at `VideoPlayer.tsx:72-74`. The seek effect checks `if (now - lastSeekTime.current > 50)`. At keyboard repeat rate (~33ms), half the arrow presses are throttled. This causes the preview to appear to "not update" during rapid stepping.

**Secondary suspect: React batching.** `setIsPlaying(false)` and `setPlayheadPosition(newPos)` are two Zustand calls from inside a React event handler (`onKeyDown`). React 18 batches all state updates within event handlers, but Zustand's external store updates may not batch identically. If `playing` is still `true` when `VideoPlayer`'s seek effect runs, the `if (playing) return` guard skips the seek.

**Approach:** Write failing tests, then investigate both suspects. Do NOT precommit to a specific fix until root cause is confirmed.

**File:** `tests/unit/arrow-key-preview.test.tsx` (new)
- Test: single arrow right updates playhead position in store AND triggers VideoPlayer seek
- Test: rapid arrow presses (< 50ms apart) all result in video seeks (debounce too aggressive)
- Test: PlaybackPanel `effectivePosition` reflects arrow key position when paused
- Test: VideoPlayer seek effect fires with `playing=false` after arrow key (no stale `playing` guard)

### Step 1.4: Arrow Key Preview Update — Fix

**Files to modify (determined by test results):**

**If 50ms debounce is root cause:** `src/renderer/components/preview/VideoPlayer.tsx`
- Remove or reduce the debounce threshold for frame-stepping. Consider making it 0ms for seek (no throttle) or using a different mechanism (requestAnimationFrame-based throttle instead of Date.now() comparison).

**If React batching / playing guard is root cause:** `src/renderer/components/preview/VideoPlayer.tsx`
- Ensure the seek effect doesn't short-circuit on stale `playing` prop. Could use `useRef` for playing state to avoid effect dependency timing issues.

**Important: Do NOT remove the `!isPlaying` guard in PlaybackPanel's emitter handler** (`PlaybackPanel.tsx:42`). Removing it would cause 60fps React re-renders during playback, creating a performance regression. The store-based path (storePosition → effectivePosition when paused) is the correct path for arrow key scrubbing.

### Step 1.5: Play-From-Selected-Frame Bug — Failing Test

**Analysis:** When user seeks with arrow keys and presses space, playback should start from the seeked position. The `usePlayhead` effect (line 34-35) reads `positionRef.current = useTimelineStore.getState().playheadPosition` when `isPlaying` becomes true. This SHOULD be the arrow-key position since `setPlayheadPosition(newPos)` was called.

Possible issue: `positionRef.current` may have been overwritten by the last RAF tick's position before the tick was cancelled. The RAF cancellation (line 71: `cancelAnimationFrame(rafRef.current)`) happens in the cleanup function, but the last tick may have already written a stale position to `positionRef.current`.

**File:** `tests/unit/play-from-seek.test.tsx` (new)
- Test: after arrow key seek to frame N, pressing play starts from frame N
- Test: after ruler click seek to position T, pressing play starts from position T
- Test: playhead position in store matches visual position after seek + play

### Step 1.6: Play-From-Selected-Frame — Fix

**File to modify:** `src/renderer/hooks/usePlayhead.ts`

**Fix:** Ensure `positionRef` is authoritatively synced from the store when playback starts, overriding any stale RAF position:

```typescript
useEffect(() => {
  if (!isPlaying) return
  // CRITICAL: always read from store — positionRef may be stale from last RAF tick
  positionRef.current = useTimelineStore.getState().playheadPosition
  // ... rest of RAF setup
}, [isPlaying, ...])
```

This code already exists at line 35 — verify it runs AFTER the RAF cleanup function from the previous effect invocation. If the cleanup cancels the RAF but the last tick already wrote a position, this sync should override it. If it doesn't, add an explicit `positionRef.current` reset in the cleanup.

---

## Phase 2: Follow Playhead Toggle

### Step 2.1: Store Changes + Persistence

**File to modify:** `src/renderer/stores/ui-store.ts`
- Add `followPlayhead: boolean` (default: false) and `setFollowPlayhead: (follow: boolean) => void`

**Session persistence:** The spec requires `followPlayhead` to persist across sessions. Use the existing `settings` table in `project-store.ts` (lines 109-112). Add IPC handlers:
- `settings:get('followPlayhead')` → read on app startup, initialize ui-store
- `settings:set('followPlayhead', value)` → write when toggle changes

**File to modify:** `src/main/ipc/project.ipc.ts` — add settings get/set IPC if not already present
**File to modify:** `src/renderer/stores/ui-store.ts` — call settings IPC in `setFollowPlayhead` to persist

### Step 2.2: Properties Panel Toggle UI

**File to modify:** `src/renderer/components/properties/PropertiesPanel.tsx`

**Changes:**
- Add a toggle button/icon at top of PropertiesPanel
- When `followPlayhead` is ON and `isPlaying` is true, subscribe to `playheadEmitter`
- **Debounce:** Only call `setSelectedSegment(segmentId)` when the segment boundary actually changes (compare current segment ID vs previously set ID) — NOT on every emitter tick. The emitter fires at 60fps; segment boundaries change maybe 1-5 times per minute. This prevents 60fps store updates.
- When OFF, preserve manual selection — do not subscribe to emitter

### Step 2.3: Tests

**File:** `tests/unit/follow-playhead.test.tsx` (new)
- Test: toggle button renders in PropertiesPanel
- Test: when follow mode ON and playing, selectedSegmentId updates when playhead crosses segment boundary
- Test: when follow mode ON and playing, selectedSegmentId does NOT update on every emitter tick (only boundary crossings)
- Test: when follow mode OFF, selectedSegmentId stays on manually selected segment during playback
- Test: follow mode state persists in ui-store

---

## Phase 3: Overlay Types + Data Model Foundation

### Step 3.1: Overlay Type Definitions

**File:** `src/shared/types/overlay.ts` (new)

```typescript
export type OverlayType = 'intro' | 'exit' | 'title' | 'section'
export type TransitionAnimation = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'typewriter' | 'none'

export interface TextOverlayElement {
  id: string
  overlayType: OverlayType
  text: string
  x: number           // percentage 0-100
  y: number           // percentage 0-100
  width: number       // percentage 0-100
  height: number      // percentage 0-100
  fontFamily: string
  fontSize: number    // px
  color: string       // hex
  backgroundColor: string  // hex
  backgroundOpacity: number // 0-1
  transitionIn: TransitionAnimation
  transitionOut: TransitionAnimation
  transitionDuration: number // ms
}

// v1: single element per overlay segment. The type uses a direct element
// (not an array) for clarity. Future v2 may change to elements[] for multi-layer.
export interface OverlaySegmentMetadata {
  element: TextOverlayElement
}

// Type-safe JSON boundary crossing — always use this to read overlay data
export function parseOverlayMetadata(segment: { metadata?: string }): OverlaySegmentMetadata | null {
  if (!segment.metadata) return null
  try {
    const parsed = JSON.parse(segment.metadata)
    if (!parsed?.element?.id || !parsed?.element?.overlayType) return null
    return parsed as OverlaySegmentMetadata
  } catch {
    return null
  }
}

// Factory for creating default overlay metadata by type
export function defaultOverlayMetadata(overlayType: OverlayType): OverlaySegmentMetadata {
  return {
    element: {
      id: crypto.randomUUID(),
      overlayType,
      text: overlayType === 'intro' ? 'Introduction' :
            overlayType === 'exit' ? 'Thank You' :
            overlayType === 'title' ? 'Title' : 'Section',
      x: 50, y: 50, width: 60, height: 20,
      fontFamily: 'Inter',
      fontSize: 32,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.7,
      transitionIn: 'fade',
      transitionOut: 'fade',
      transitionDuration: 500,
    }
  }
}
```

### Step 3.2: Extend Segment Type with Optional Metadata

**File to modify:** `src/shared/types/timeline.ts`

```typescript
export interface Segment {
  id: string
  trackId: string
  startTime: number
  endTime: number
  sourceFile: string  // empty string '' for overlay segments
  sourceOffset: number // 0 for overlay segments
  label: string
  metadata?: string   // JSON-serialized OverlaySegmentMetadata for overlay segments
}
```

Using `metadata?: string` (JSON) rather than typed field because:
- The existing `saveTimeline()` serializes segments to SQLite — a text column stores naturally
- The timeline-store's zundo temporal tracks the Segment as-is — undo/redo covers metadata
- Parsing happens only in overlay-specific components

### Step 3.3: Database Migration + Persistence Plumbing

**File to modify:** `src/main/services/project-store.ts`

**3.3a: Schema migration** — Add metadata column:
```sql
ALTER TABLE segments ADD COLUMN metadata TEXT;
```
Add this to the migration/initialization logic (e.g., `initDb()` or a versioned migration).

**3.3b: Write path** — Modify the `insertSegment` prepared statement (currently at ~line 425-426):
```sql
-- FROM:
INSERT INTO segments (id, track_id, start_time, end_time, source_file, source_offset, label)
VALUES (?, ?, ?, ?, ?, ?, ?)

-- TO:
INSERT INTO segments (id, track_id, start_time, end_time, source_file, source_offset, label, metadata)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```
Pass `seg.metadata ?? null` as the 8th parameter in the `saveTimeline()` transaction.

**3.3c: Read path** — Modify the `getTimeline` row mapping (currently at ~line 469-477):
```typescript
// Add to the Segment object construction from the DB row:
metadata: (sr.metadata as string) ?? undefined
```

This ensures overlay metadata round-trips through save/reload correctly. Without these changes, metadata would be silently lost on every auto-save cycle.

### Step 3.4: Overlay Editor Store (UI-only state)

**File:** `src/renderer/stores/overlay-editor-store.ts` (new)

This store holds UI/editor state ONLY — not persistent data (that lives in Segment.metadata):
- `selectedElementId: string | null`
- `editorMode: 'select' | 'text' | 'drag'`
- `setSelectedElement(id: string | null)`
- `setEditorMode(mode)`

**Why separate:** Editor state like "which element is selected" or "what tool is active" is ephemeral — it should not participate in undo/redo or persistence. The overlay DATA is in Segment.metadata (persistent, undo-able).

### Step 3.5: Workspace Preset Extension

**Files to modify:**
- `src/renderer/stores/ui-store.ts` — add `'effects'` to `WorkspacePreset` union type
- `src/renderer/components/layout/Toolbar.tsx` — add Effects tab to `WORKSPACE_TABS` array and the tab rendering logic
- `src/renderer/components/layout/PanelSystem.tsx` — add effects preset layout branch

**PanelSystem effects preset layout (code skeleton):**

The current PanelSystem has a bottom section that renders script editors (`ScriptOnlyView` / `InlineEditorView`), NOT the `<Timeline />` component directly. The effects preset must render `<Timeline />` directly in the bottom section.

```tsx
// In PanelSystem.tsx, add a branch for the effects preset:
if (preset === 'effects') {
  return (
    <div className="panel-system effects-layout">
      {/* Main area: EffectsCanvas with video frame + text overlays */}
      <div className="panel-main">
        <EffectsCanvas />
      </div>
      {/* Right panel: PropertiesPanel (which auto-renders OverlayProperties for overlay segments) */}
      <div className="panel-right" style={{ width: propertiesCollapsed ? 0 : 300 }}>
        <PropertiesPanel />
      </div>
      {/* Bottom panel: Timeline rendered DIRECTLY (not through InlineEditorView) */}
      <div className="panel-bottom" style={{ height: timelineCollapsed ? 0 : timelineHeight }}>
        <Timeline />
      </div>
    </div>
  )
}
```

**Note:** The `EffectsCanvas` component (Phase 4) embeds its own `<VideoPlayer>` to show the current frame as background, separate from the `PlaybackPanel` used in compose preset. This avoids coupling between the two presets.

### Step 3.6: Add Overlay Actions to Timeline Store

**File to modify:** `src/renderer/stores/timeline-store.ts`

Add two new actions:

**`addOverlaySegment(overlayType: OverlayType, startTime: number, duration?: number)`:**
- Creates/finds the overlay track (auto-creates with `type='overlay'` if none exists)
- Creates a Segment with `sourceFile=''`, `sourceOffset=0`, `label=overlayType`, `metadata=JSON.stringify(defaultOverlayMetadata(overlayType))` (using the factory from `overlay.ts`)
- Duration defaults to 3000ms
- Recomputes timeline duration via `computeDuration()` — overlay segments CAN extend timeline duration (intentional: an exit card at the end extends the total duration)

**`updateSegmentMetadata(segmentId: string, metadata: string)`:**
- Finds the segment across all tracks, updates its `metadata` field
- This is the action used by the canvas editor to persist element property changes (position, text, style, etc.)
- Goes through zundo temporal → undo/redo coverage
- Triggers auto-save subscriber → SQLite persistence

### Step 3.7: Tests

**Files:**
- `tests/unit/overlay-store.test.ts` — overlay editor store CRUD
- `tests/unit/overlay-segment-metadata.test.ts` — add overlay segment, verify metadata parsed, verify undo/redo covers metadata, verify removeSegment cascades (metadata goes with segment)
- `tests/integration/overlay-persistence.test.ts` — save timeline with overlay segments, reload, verify metadata column persisted

---

## Phase 4: Effects Canvas Editor

### Step 4.1: PlaybackPanel — Handle Overlay Segments

**File to modify:** `src/renderer/components/preview/PlaybackPanel.tsx`

**Critical fix (from Architect review):** `findSegmentAt()` at line 12 searches ALL tracks including overlay tracks. When playhead is over an overlay segment, `activeClip` would be `undefined` (no matching clip file), showing "No video to preview".

**Fix:** Change `findSegmentAt` to search only `type === 'clip' || type === 'recording'` tracks for video playback. The overlay segment's presence should NOT affect video preview — the video underneath should still display.

### Step 4.2: Canvas Container

**File:** `src/renderer/components/effects/EffectsCanvas.tsx` (new)

**Layout:**
- Relative-positioned container with its own embedded `<VideoPlayer>` showing the current frame as background
- The video frame source is determined the same way as `PlaybackPanel`: find active video segment at playhead position (filtering to `type === 'clip' || type === 'recording'` tracks), calculate video time, pass to VideoPlayer
- Text overlay element rendered as absolutely-positioned HTML div on top of the video
- Selection state: click to select the element, show resize handles
- **v1 single-element model:** Each overlay segment has exactly one `TextOverlayElement`. The canvas reads it from `parseOverlayMetadata(segment).element`. No "add element" button in v1.

**Video frame rendering:** EffectsCanvas embeds its own `<VideoPlayer>` rather than sharing with PlaybackPanel. This decouples the effects preset from the compose preset and avoids state sharing issues when switching between presets.

### Step 4.3: Draggable Text Element

**File:** `src/renderer/components/effects/TextOverlayElement.tsx` (new)

**Interactions:**
- Click to select → show selection handles + update `overlay-editor-store.selectedElementId`
- Drag to reposition → parse current metadata via `parseOverlayMetadata()`, update element `x, y`, serialize back, call `updateSegmentMetadata(segmentId, newMetadataJson)` on timeline-store
- Resize handles on corners → same flow for `width, height`
- Double-click to edit text inline (contentEditable)
- Uses pointer events (not HTML5 drag) per established codebase pattern (`usePointerDrag` hook)
- **v1:** Only one element per overlay, so no element selection list — the single element is always "selected" when its overlay segment is selected

### Step 4.4: Overlay Properties Panel

**File:** `src/renderer/components/effects/OverlayProperties.tsx` (new)

**Fields:**
- Text content (textarea)
- Position: x, y (number inputs, 0-100%)
- Size: width, height (number inputs, 0-100%)
- Font: family (dropdown), size (number), color (color picker)
- Background: color (color picker), opacity (slider 0-1)
- Transition in/out: type (dropdown), duration (number ms)

### Step 4.5: Integration with PropertiesPanel

**File to modify:** `src/renderer/components/properties/PropertiesPanel.tsx`
- When selected segment is on an overlay track (`track.type === 'overlay'`), render `OverlayProperties` instead of `SegmentProperties`

### Step 4.6: Tests

**Files:**
- `tests/unit/effects-canvas.test.tsx` — canvas renders, elements display at correct positions
- `tests/unit/text-overlay-drag.test.tsx` — pointer events update position in segment metadata
- `tests/unit/overlay-properties.test.tsx` — property changes update segment metadata
- `tests/unit/playback-overlay-filter.test.tsx` — PlaybackPanel still shows video when overlay segment exists at playhead position

---

## Phase 5: Timeline Integration

### Step 5.1: Overlay Segment Rendering

**File to modify:** `src/renderer/components/timeline/TrackLane.tsx`
- Detect overlay tracks and render overlay segments with distinct styling
- Color-code by overlay type: intro=#3b82f6, exit=#ef4444, title=#f59e0b, section=#8b5cf6
- Show overlay type badge on each segment

### Step 5.2: Drag Handles for Timing

**File to modify:** `src/renderer/components/timeline/Segment.tsx`
- Extend the existing `segment-edge-left` and `segment-edge-right` divs (already present at ~lines 72-73 with no-op handlers) to handle drag for overlay segments
- The existing `usePointerDrag` hook (~line 49-54) already wraps these edges — wire the drag callbacks to update `startTime`/`endTime` in timeline-store
- For overlay segments only (check `track.type === 'overlay'`) — video segment edges should remain no-op for now

### Step 5.3: Add Overlay Toolbar

**File:** `src/renderer/components/effects/OverlayToolbar.tsx` (new)
- Buttons: "Add Intro", "Add Exit", "Add Title", "Add Section"
- Creates segment on overlay track at current playhead position with default 3s duration
- Integrated into the effects preset layout

### Step 5.4: Tests

**Files:**
- `tests/unit/overlay-timeline.test.tsx` — overlay segments render on overlay track with correct colors
- `tests/unit/overlay-drag-handles.test.tsx` — drag handles update timing in store
- `tests/unit/overlay-toolbar.test.tsx` — toolbar buttons create overlay segments at playhead position

---

## Phase 6: FFmpeg Export Integration

### Step 6.1: Drawtext Filter Generation

**File to modify:** `src/main/utils/ffmpeg-builder.ts`

Add new function `buildDrawtextFilters(overlaySegments: Array<{segment: Segment, metadata: OverlaySegmentMetadata}>, videoWidth: number, videoHeight: number): string[]`

**Note:** The existing `buildOverlayFilter` (line 119-133) is for video compositing (placing one video stream on another). The new `buildDrawtextFilters` is for text overlays using FFmpeg's `drawtext` filter — completely different filter type. Do not confuse the two.

**Mapping:**
- `x, y` (percentage) → absolute pixel coordinates: `x * videoWidth / 100`
- `fontFamily` → `fontfile` parameter (or `font` for system fonts)
- `fontSize` → `fontsize`
- `color` → `fontcolor`
- `backgroundColor + opacity` → `box=1:boxcolor=color@opacity`
- `transitionIn/Out` → `enable='between(t, start, end)'` with alpha expression for fade

### Step 6.2: Export Pipeline Integration

**File to modify:** `src/main/utils/ffmpeg.ts`
- When exporting, read overlay segments from timeline, parse metadata, build drawtext filters, add to FFmpeg command chain

### Step 6.3: Tests

**Files:**
- `tests/unit/ffmpeg-drawtext-filters.test.ts` — drawtext filter string generation for each overlay type
- `tests/unit/ffmpeg-transition-expressions.test.ts` — fade/slide enable expressions
- `tests/integration/ffmpeg-overlay-export.test.ts` — full export with overlays produces valid video file

---

## Phase 7: E2E Tests (Playwright)

### Step 7.1: Playwright Setup

**File:** `tests/e2e/setup.ts` (new if needed)
- Electron app launch via @playwright/test electron module
- Window handle acquisition, cleanup

### Step 7.2: Playback Bug E2E

**File:** `tests/e2e/playback-controls.spec.ts` (new)
- E2E: spacebar toggles play/pause from any focused panel
- E2E: arrow keys step frames with preview update visible
- E2E: play starts from arrow-key-seeked position

### Step 7.3: Canvas Editor E2E

**File:** `tests/e2e/effects-canvas.spec.ts` (new)
- E2E: switch to effects preset, canvas visible
- E2E: add overlay segment from toolbar
- E2E: drag text element on canvas, verify position change
- E2E: edit text in properties panel, verify canvas update
- E2E: overlay segment appears on timeline with correct timing
- E2E: drag handle changes overlay duration

---

## ADR: Architecture Decision Record

### Decision
Overlay persistent data embeds in `Segment.metadata` (JSON text field), with a separate `overlay-editor-store` for ephemeral UI state only. The canvas uses HTML/CSS elements positioned over a video frame in a new "effects" workspace preset. FFmpeg `drawtext` filters handle export.

### Drivers
- User requires visual drag-and-drop canvas (not form-based)
- 4 overlay types share identical data model and editor
- Data must participate in existing undo/redo (zundo), cascade delete, and auto-save without new coordination logic
- FFmpeg export requires text properties → drawtext filter mapping
- Existing PanelSystem supports adding new workspace presets

### Alternatives Considered
1. **Separate overlay-store for persistent data** — clean code separation, but creates distributed data problem requiring cascade hooks for delete/undo/save. Every lifecycle operation needs explicit coordination between two stores. Rejected for data integrity risk.
2. **Canvas2D rendering** — pixel-perfect preview/export match, but enormously harder to implement text editing, selection, and accessibility. Rejected for pragmatism.
3. **Overlays in compose view** — avoids new preset, but compose already has 4 dense panels. Rejected for UX clarity.
4. **Template-only approach** — pre-built lower-thirds with no custom positioning. Rejected because user explicitly wants drag-to-position.

### Why Chosen
Embedding overlay data in `Segment.metadata` preserves the single-source-of-truth invariant that the codebase relies on. Undo/redo, cascade delete, and auto-save work automatically with zero new coordination code. The separate `overlay-editor-store` keeps ephemeral UI state out of the persistent path. HTML/CSS provides the fastest path to a working canvas editor. A separate effects preset gives dedicated screen real estate.

### Consequences
- `Segment` type gains an optional `metadata?: string` field — slightly fatter type
- Overlay data requires JSON parse/serialize at read/write boundaries
- Slight visual differences between HTML preview and FFmpeg export output (font rendering)
- FFmpeg `drawtext` has limited layout capabilities vs CSS (word-wrap, percentage positioning need conversion)
- Transition animations (slide, typewriter) require non-trivial FFmpeg filter expressions

### Known Limitations (v1)
- Single text element per overlay segment
- No keyframe animation curves (preset transitions only)
- HTML/FFmpeg visual mismatch for complex layouts
- No "preview export" button (future follow-up)

### Follow-ups
- Add "preview export" button for short clip FFmpeg render to verify visual match
- Support multi-element overlays
- Consider animation curve editor if preset transitions prove insufficient
