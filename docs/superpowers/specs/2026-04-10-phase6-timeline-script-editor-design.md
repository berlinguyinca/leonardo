# Phase 6: Timeline Editor & Script Editor — Design Spec

## Goal

NLE-style multi-track timeline editor for reviewing and adjusting sync points, plus a three-view script editor with voice assignment. This phase builds the primary editing UI that connects the recording engine (Phase 2), AI-generated scripts (Phase 3), TTS pipeline (Phase 4), and sync engine (Phase 5) into a cohesive authoring experience.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Timeline rendering | DOM-Based (React + CSS transforms) | Typical Leonardo projects have 4-8 tracks / 10-50 segments — DOM handles this comfortably. Keeps everything in React, testable, integrates with Zustand. Waveform rendering can use a small canvas element within the audio track if needed. |
| Drag & drop | @dnd-kit for structural reordering + raw pointer events for timeline interactions | @dnd-kit handles track reorder and cross-track segment moves well. Timeline-specific interactions (playhead scrub, segment edge resize, sync point drag) are constrained horizontal operations better served by direct pointer math. |
| Script editor | Tiptap (ProseMirror-based) | Custom schema maps to ScriptSection with voice metadata on paragraph nodes. Timing markers become inline node decorations. Built-in undo/redo, selection, keyboard shortcuts. |
| View switching | Toolbar segmented control | Three-button toggle (Script / Split / Timeline) in the main app Toolbar. Bottom panel gets full height for editor content. View toggle is always visible regardless of active view. |
| Playhead sync | Ref-driven rendering + store for state snapshots | During playback, playhead position is tracked in a React ref and moved via `translateX`. Store is updated only on pause/stop/seek for persistence and undo/redo. PlayheadEmitter (mitt) handles cross-component sync without re-renders. |
| Sync point editing | Inline + Properties Panel | Quick actions (move, resize, delete) happen on the timeline. Clicking a sync point populates the Properties Panel in the right sidebar with a full form (type, duration, coordinates, annotation text, confidence). |
| Dual-pane sync | Selection-driven with soft scroll following | Click paragraph → timeline scrolls to corresponding time range. Click segment → script scrolls to paragraph. Scrolling without clicking triggers proportional soft follow in the other pane. |

## Component Architecture

```
PanelSystem (existing)
├── BottomPanel (existing slot)
│   ├── ScriptOnlyView         — shown when toolbar mode = "script"
│   │   ├── TiptapEditor       — ProseMirror with custom ScriptSection nodes
│   │   ├── SectionBlock[]     — paragraph + voice dropdown + timing badges
│   │   └── TimingMarkerChip   — inline [PAUSE], [ZOOM] decorations
│   ├── DualPaneView           — shown when toolbar mode = "split"
│   │   ├── ScriptPane         — reuses TiptapEditor in compact mode
│   │   ├── ResizeDivider      — draggable split handle
│   │   └── TimelineMinimap    — compressed timeline view
│   └── InlineEditorView       — shown when toolbar mode = "timeline"
│       ├── Timeline
│       │   ├── TimeRuler      — horizontal time scale with tick marks
│       │   ├── Playhead       — ref-driven vertical line, pointer scrubbing
│       │   ├── TrackLane[]    — one per track: recording, audio, effects, overlay
│       │   │   ├── TrackHeader    — label, mute/lock/solo buttons
│       │   │   ├── Segment[]      — positioned via CSS transform, pointer-draggable
│       │   │   └── SyncPointMarker[] — color-coded, draggable, edge-resizable
│       │   ├── ZoomControls   — +/- buttons, Cmd+scroll
│       │   └── ScrollContainer — horizontal scroll with momentum
│       └── InlineTextPopup    — click audio segment → popup text + voice editor
├── RightPanel (existing slot)
│   └── PropertiesPanel        — shows when a sync point or segment is selected
│       ├── SyncPointProperties — type, duration, coords, annotation text
│       └── SegmentProperties   — start/end time, source, label
└── Toolbar (existing — modified)
    └── ViewModeToggle         — segmented control: Script | Split | Timeline
```

## New Files

### Timeline Components (`src/renderer/components/timeline/`)

| File | Responsibility |
|---|---|
| `Timeline.tsx` | Root timeline container — manages scroll, zoom, renders tracks |
| `TimeRuler.tsx` | Horizontal time scale with tick marks at zoom-dependent intervals |
| `Playhead.tsx` | Vertical playhead line — ref-driven position, pointer scrubbing on ruler |
| `TrackLane.tsx` | Single track lane — renders segments and sync point markers |
| `TrackHeader.tsx` | Track label, mute/lock/solo toggle buttons |
| `Segment.tsx` | Individual segment block — CSS transform positioning, pointer drag/resize |
| `SyncPointMarker.tsx` | Color-coded marker on effects track — draggable, edge-resizable |
| `ZoomControls.tsx` | +/- buttons and zoom level display |
| `ScrollContainer.tsx` | Horizontal scrollable wrapper with momentum scrolling |
| `InlineTextPopup.tsx` | Popup editor for narration text/voice on audio segments |
| `TimelineMinimap.tsx` | Compressed timeline view for the dual-pane split |

### Script Editor Components (`src/renderer/components/script-editor/`)

| File | Responsibility |
|---|---|
| `ScriptOnlyView.tsx` | Full script editor view — wraps TiptapEditor with section list |
| `DualPaneView.tsx` | Side-by-side script + timeline minimap with resize divider |
| `InlineEditorView.tsx` | Timeline-first view with inline text editing popups |
| `TiptapEditor.tsx` | Tiptap instance with custom schema, extensions, and toolbar |
| `SectionBlock.tsx` | Single script section — text area, voice dropdown, timing badges |
| `TimingMarkerChip.tsx` | Inline decoration for [PAUSE], [ZOOM], [FREEZE], [TRANSITION] |
| `ResizeDivider.tsx` | Draggable divider between script pane and timeline minimap |

### Properties Panel (`src/renderer/components/properties/`)

| File | Responsibility |
|---|---|
| `PropertiesPanel.tsx` | Container — switches between sync point and segment property forms |
| `SyncPointProperties.tsx` | Form: type dropdown, duration input, coordinates, annotation text, confidence |
| `SegmentProperties.tsx` | Form: start/end time inputs, source label, track assignment |

### Toolbar Addition (`src/renderer/components/layout/`)

| File | Responsibility |
|---|---|
| `ViewModeToggle.tsx` | Segmented control in Toolbar: Script / Split / Timeline |

### Hooks (`src/renderer/hooks/`)

| File | Responsibility |
|---|---|
| `usePointerDrag.ts` | Generic pointer drag hook — onPointerDown/Move/Up with requestAnimationFrame, snap support, axis constraint |
| `usePlayhead.ts` | Playhead management — ref-based position, scrub interaction, emitter integration |
| `useTimelineZoom.ts` | Zoom level state, Cmd+scroll handler, cursor-stable zoom math |
| `useScrollSync.ts` | Soft scroll following for dual-pane — proportional scroll position sync |
| `useDualPaneSync.ts` | Selection-driven bi-directional sync between script sections and timeline position |
| `PlayheadEmitter.ts` | mitt-based event emitter for real-time playhead position broadcasting |

## Data Flow

### Store Responsibilities

- **`timeline-store`** (existing) — Tracks, segments, sync points, playhead position (on pause/seek), zoom level, selected items. All timeline mutations go through here. Zundo provides undo/redo (100 state limit).
- **`ui-store`** (existing, extended) — New field: `editorViewMode: 'script' | 'split' | 'timeline'` for the toolbar segmented control.
- **`project-store`** (existing) — Active project, script data. Script sections are the source of truth for text content.

### Key Flows

1. **Script edit → store → timeline update**: User edits section text in Tiptap → `project-store.updateSection()` → if timing markers changed, `timeline-store` sync points update accordingly.
2. **Sync point drag → store → properties panel**: User drags sync point on timeline → pointer events update position in real-time via ref → on pointer up, `timeline-store.updateSyncPoint()` → PropertiesPanel re-renders with new values.
3. **Playhead scrub → emitter → consumers**: User drags playhead → `usePointerDrag` moves DOM element via ref → `PlayheadEmitter.emit(position)` → script editor highlights active paragraph, preview seeks.
4. **Selection sync (dual-pane)**: Click paragraph → `timeline-store.setSelectedSection(id)` → timeline scrolls to `section.startTime`. Click segment → same store field → script editor scrolls to paragraph. Scroll without click → proportional soft follow via `useScrollSync`.
5. **Inline text edit**: Click audio segment on timeline → `InlineTextPopup` opens, pre-filled from `project-store` section data → edits save back to `project-store` → triggers incremental TTS re-generation via IPC.

### New Dependencies

| Package | Purpose | Size |
|---|---|---|
| `@tiptap/react` | React bindings for Tiptap editor | ~25KB gzipped |
| `@tiptap/starter-kit` | Base extensions (bold, italic, history, etc.) | ~20KB gzipped |
| `@tiptap/pm` | ProseMirror core (peer dep) | ~15KB gzipped |
| `@dnd-kit/core` | Drag and drop primitives | ~10KB gzipped |
| `@dnd-kit/sortable` | Sortable preset for track reordering | ~5KB gzipped |
| `mitt` | Tiny event emitter for PlayheadEmitter | ~200 bytes |

## Interaction Details

### Timeline Interactions (Raw Pointer Events)

**Playhead scrubbing**: Click/drag on TimeRuler. `onPointerDown` captures pointer, `onPointerMove` updates playhead via ref + `translateX`, `onPointerUp` writes position to store and emits via PlayheadEmitter.

**Segment move**: `onPointerDown` on segment records grab offset. `onPointerMove` constrains to horizontal axis within track lane, applies snap logic. Ghost overlay shows drop position. `onPointerUp` commits to store.

**Segment edge resize**: 6px hit zone on left/right edges. Cursor changes to `col-resize`. Drag adjusts `startTime` or `endTime` with minimum duration of 100ms.

**Sync point move**: Same as segment move but on the effects track. Color-coded markers: blue=freeze, green=zoom, yellow=annotation, purple=transition.

**Sync point resize**: Edge handles on freeze and zoom markers to change duration. Annotations and transitions are point-in-time (no duration to resize).

**Zoom**: Cmd+scroll wheel on timeline. `useTimelineZoom` manages zoom level (0.1x to 10x) and keeps cursor position stable during zoom. +/- buttons in ZoomControls for accessibility.

### Timeline Interactions (@dnd-kit)

**Track reorder**: Drag track headers vertically to reorder lanes. `@dnd-kit/sortable` handles animation and drop logic. Updates `zOrder` in store.

**Segment between tracks**: Drag segment from one track to another. Drop target highlights valid lanes.

### Right-Click Context Menus

- **Sync point**: Change type (submenu), Edit properties, Delete, Duplicate
- **Segment**: Split at playhead, Delete, Properties
- **Track**: Add track above/below, Delete track, Toggle mute/lock

### Snap Behavior

- Grid snap at zoom-dependent intervals (0.5s at 1x zoom, 0.1s at 5x zoom)
- Snap to sync points within 10px
- Snap to segment edges within 10px
- Hold Alt to disable snap temporarily

### Keyboard Shortcuts

| Key | Action |
|---|---|
| Space | Play/pause |
| Cmd+1 / Cmd+2 / Cmd+3 | Switch editor view (Script / Split / Timeline) |
| Cmd+Z / Cmd+Shift+Z | Undo / redo (Zundo) |
| Delete / Backspace | Delete selected sync point or segment |
| Cmd+D | Duplicate selected |
| + / - | Zoom in / out |
| Left / Right arrows | Nudge selected item by 1 grid unit |
| Home / End | Jump playhead to start / end |

## Testing Strategy

### Unit Tests (Vitest)

- **Timeline position math** — `timeToPixel(time, zoom, scrollOffset)` and `pixelToTime(px, zoom, scrollOffset)` pure functions with edge cases: zero duration, extreme zoom levels, negative offset.
- **Segment collision detection** — `detectOverlap(segment, segments)` and `findSnapTarget(position, targets, threshold)` with overlapping, adjacent, and gap scenarios.
- **Snap logic** — Grid snap, sync point snap, segment edge snap, Alt-to-disable. Each snap source independently and combined priority.
- **Zoom calculations** — Cursor-stable zoom: zoom in at position X, verify X remains under cursor.
- **PlayheadEmitter** — Subscribe, emit, unsubscribe, verify no memory leaks.
- **Tiptap schema** — Custom SectionBlock node serializes/deserializes correctly. Timing marker decorations render at correct positions.
- **Dual-pane sync** — Selection-driven scroll maps section IDs to time ranges. Soft scroll following maps scroll percentages correctly.

### Integration Tests (Vitest + React Testing Library)

All integration tests use **real dependencies, no mocks**. Each test suite seeds a fresh in-memory `better-sqlite3` database with fixture data.

- **Script edit → TTS re-generation** — Mount TiptapEditor with real store and real IPC handlers. Edit section text → verify IPC call to `tts:generate` fires with updated text. TTS provider is a real local stub implementing `ITTSProvider` that writes a silent WAV (not a mock).
- **Sync point CRUD on timeline** — Render Timeline with seeded DB data → simulate pointer events to add/move/resize/delete sync points → verify `timeline-store` state matches expected DB state.
- **View mode switching** — Click each toolbar toggle → verify correct view renders with real store state → verify state persists across switches.
- **Properties panel sync** — Select sync point on timeline → verify PropertiesPanel shows correct values from DB → edit in panel → verify timeline and DB update.
- **Undo/redo** — Move a sync point via pointer events → undo → verify store and DOM restored → redo → verify re-applied.

### E2E Tests (Playwright)

- Open project → switch between 3 editor views via toolbar → verify each renders.
- Edit script text → verify timing markers appear as inline decorations.
- Drag sync point on timeline → verify new position persists after save/reload.
- Dual-pane: click paragraph → verify timeline scrolls to corresponding time range.
- Right-click sync point → context menu → change type → verify color changes.
- Keyboard shortcuts: Space for play/pause, Cmd+Z for undo, +/- for zoom.

### Coverage Target

80%+ on all new code. Pure utility functions (position math, snap logic, collision detection) target ~95%.

## Acceptance Criteria

- [ ] Timeline shows multiple tracks with segments
- [ ] Sync points are visualized as color-coded markers
- [ ] Sync points can be moved, resized, deleted, and type-changed
- [ ] Playhead scrubs through the timeline smoothly
- [ ] Script-only view supports full-text editing with voice assignment
- [ ] Dual-pane view syncs paragraph selection ↔ timeline position with soft scroll following
- [ ] Inline editing allows text/voice changes directly on timeline
- [ ] Drag and drop works for track reordering and segments within the timeline
- [ ] Properties panel shows and edits selected sync point / segment details
- [ ] Toolbar segmented control switches between three editor views
- [ ] Cmd+1/2/3 keyboard shortcuts switch views
- [ ] Undo/redo works across all editing operations
- [ ] All integration tests seed real SQLite DB, no mocks
