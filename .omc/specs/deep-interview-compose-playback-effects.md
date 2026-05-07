# Deep Interview Spec: Compose Playback Fixes + Effects Preset

## Metadata
- Interview ID: di-compose-playback-2026-04-12
- Rounds: 10
- Final Ambiguity Score: 15.3%
- Type: brownfield
- Generated: 2026-04-12
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 0.35 | 0.315 |
| Constraint Clarity | 0.80 | 0.25 | 0.200 |
| Success Criteria | 0.85 | 0.25 | 0.213 |
| Context Clarity | 0.80 | 0.15 | 0.120 |
| **Total Clarity** | | | **0.848** |
| **Ambiguity** | | | **15.3%** |

## Goal

Fix three playback control bugs in the compose view (spacebar inconsistency, arrow key preview not updating, play-from-selected-frame broken), add a "follow playhead" toggle to the Properties panel for auto-tracking during playback, and build a new "Effects" workspace preset with a visual canvas editor for four overlay types (intro cards, exit cards, title cards, section dividers) with text, positioning, styling, backgrounds, and transition animations — rendered as HTML/CSS in the editor and FFmpeg drawtext/overlay for export.

## Constraints

### Technical
- **Rendering**: HTML/CSS overlay on video element for editor preview; FFmpeg drawtext/overlay filters for final export
- **Workspace**: New "effects" preset (5th tab) — canvas as main view, timeline below, properties on right
- **Overlay track**: Overlays live as segments on a dedicated `overlay` track type in the timeline, with draggable start/end handles
- **Focus management**: Spacebar must work consistently regardless of which panel has focus — investigate and fix the global keyboard handler in `useUndoRedo.ts`
- **Playhead sync**: Arrow key frame-stepping must commit position to both the `playheadEmitter` AND the store, so `VideoPlayer` can seek
- **Testing**: Full coverage — unit tests for stores/hooks/logic, integration tests for IPC/rendering, E2E (Playwright) for canvas editor interactions
- **TDD**: Write failing tests FIRST for the 3 playback bugs, then implement fixes
- **Existing test suite**: Must not break existing 571+ tests

### Non-Technical
- Priority: fix playback bugs FIRST, then auto-properties, then effects preset
- All 4 overlay types (intro, exit, title, section) use the same canvas editor with the same properties

## Non-Goals
- Video compositing or picture-in-picture features
- Audio overlay/voiceover in effects preset
- Multi-layer text (single text element per overlay for v1)
- Real-time FFmpeg preview (export only)
- Template marketplace or sharing
- Keyframe-based animation curves (simple preset transitions only)

## Acceptance Criteria

### Bug Fixes
- [ ] Spacebar toggles play/pause reliably in compose view regardless of which panel (timeline, storyboard, properties, preview) has focus
- [ ] Arrow keys (left/right) step the playhead by 1 frame (67ms) AND update the video preview to show the correct frame
- [ ] After arrow-key stepping or ruler-clicking to a position, pressing play starts playback FROM that position (not jumping elsewhere)
- [ ] All 3 bug fixes have TDD-style failing tests written BEFORE the fix
- [ ] Existing 571+ tests continue to pass

### Auto-Properties (Follow Playhead)
- [ ] Properties panel has a "Follow Playhead" toggle button
- [ ] When toggle is ON and playback is active, Properties panel auto-shows the segment under the playhead as playback crosses segment boundaries
- [ ] When toggle is OFF, manual selection is preserved during playback
- [ ] Toggle state persists across sessions (stored in ui-store or similar)

### Effects Preset
- [ ] New "Effects" tab appears in the workspace toolbar (5th preset)
- [ ] Effects preset layout: canvas editor (main), timeline (bottom), properties panel (right)
- [ ] Canvas editor renders HTML/CSS text overlays on top of the current video frame
- [ ] User can add 4 types of overlays: intro card, exit card, title card, section divider
- [ ] Each overlay type creates a segment on an "overlay" track in the timeline

### Text Canvas Editor
- [ ] User can type text and see it rendered on the canvas
- [ ] User can drag text to reposition it on the canvas (mouse interaction)
- [ ] User can resize text elements
- [ ] User can set font family, font size, and text color
- [ ] User can set background color and opacity behind text (e.g., lower-third bar)
- [ ] User can select transition animations (fade in/out, slide in/out, typewriter)
- [ ] Text properties are editable in the Properties panel when an overlay segment is selected
- [ ] Overlay segments on the timeline have draggable start/end handles for timing control

### Export Integration
- [ ] Overlays are burned into final export video using FFmpeg drawtext/overlay filters
- [ ] Export output matches editor preview within acceptable visual tolerance

### Testing
- [ ] Unit tests for: overlay store, text style store, animation state, follow-mode toggle
- [ ] Integration tests for: overlay persistence (SQLite), FFmpeg drawtext command generation
- [ ] E2E (Playwright) tests for: canvas drag interaction, text editing, overlay timing on timeline
- [ ] Bug regression tests for all 3 playback fixes

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Spacebar works globally | Tested: inconsistent behavior, likely focus-related | Confirmed: global handler in useUndoRedo.ts, PanelSystem may steal focus |
| Arrow keys update preview | Tested: playhead moves but preview doesn't update | Root cause: emitter updates visual but doesn't commit to store for VideoPlayer seek |
| Text designer needs visual canvas | Challenged with form-based alternative (contrarian) | User confirmed visual drag-and-drop canvas required |
| Overlays go in compose view | Challenged with simpler alternatives (simplifier) | User chose dedicated "effects" preset for clean separation |
| Properties should always auto-follow | Challenged with "what if you want to inspect a non-playing segment" | User chose toggle-based follow mode |
| Full canvas features needed for v1 | Challenged with simpler scope | User confirmed: text + position + size + font + color + background + opacity + transitions |
| HTML/CSS is acceptable for preview | Offered Canvas2D for pixel-perfect consistency | User chose HTML/CSS preview + FFmpeg export (pragmatic) |

## Technical Context

### Existing Infrastructure
- **Workspace presets**: `ui-store.ts` — `WorkspacePreset = 'recording' | 'compose' | 'script' | 'export'` → add `'effects'`
- **Overlay track type**: `TrackType = 'recording' | 'clip' | 'overlay' | 'audio'` — already exists but unused in UI
- **SyncPoint coordinates**: `{ x, y, width, height }` — can be repurposed or inspire overlay positioning model
- **Keyboard handler**: `useUndoRedo.ts` — global `window.addEventListener('keydown')` with input/textarea filter
- **Playhead system**: `usePlayhead.ts` with `playheadEmitter` (mitt) for real-time + store for persistence
- **VideoPlayer**: `VideoPlayer.tsx` — seeks when paused via debounced position sync
- **PlaybackPanel**: `PlaybackPanel.tsx` — tracks `activeSegmentId` via emitter subscription, already knows which segment is playing
- **FFmpeg**: `src/main/utils/ffmpeg.ts` — existing video conversion pipeline
- **Timeline persistence**: SQLite CRUD with auto-save subscriber (1s debounce)

### Key Files to Modify
- `src/renderer/hooks/useUndoRedo.ts` — fix spacebar focus handling
- `src/renderer/components/timeline/Timeline.tsx` — fix arrow key position commit
- `src/renderer/hooks/usePlayhead.ts` — ensure seekTo commits to store
- `src/renderer/components/preview/PlaybackPanel.tsx` — add follow-mode integration
- `src/renderer/components/preview/VideoPlayer.tsx` — ensure seek on store position change
- `src/renderer/stores/ui-store.ts` — add `'effects'` preset, follow-mode toggle state
- `src/renderer/stores/timeline-store.ts` — overlay segment CRUD
- `src/renderer/components/layout/PanelSystem.tsx` — effects preset layout
- `src/renderer/components/layout/Toolbar.tsx` — effects tab
- `src/renderer/components/properties/PropertiesPanel.tsx` — follow-mode toggle, overlay properties

### New Files
- `src/renderer/components/effects/EffectsCanvas.tsx` — visual canvas editor
- `src/renderer/components/effects/TextOverlay.tsx` — draggable text element
- `src/renderer/components/effects/OverlayProperties.tsx` — overlay-specific properties editor
- `src/renderer/stores/overlay-store.ts` — overlay element state (text, position, style, animation)
- `src/shared/types/overlay.ts` — overlay type definitions

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Compose View | core domain | preset, panels, layout | Contains Timeline, Preview, Properties |
| Effects Preset | core domain | canvas, timeline, properties | New workspace tab, hosts canvas editor |
| Playback Controls | core domain | play/pause, spacebar, J/K/L, arrow keys | Drives Playhead, controls VideoPlayer |
| Timeline | core domain | tracks, segments, duration, zoom | Contains Overlay Track, Clip segments |
| Playhead | core domain | position, playing, playbackRate | Syncs Preview, drives follow-mode |
| Preview/VideoPlayer | core domain | src, currentTime, playing | Renders video at playhead position |
| Clip/Segment | core domain | startTime, endTime, sourceOffset, label | Lives on clip track, has properties |
| Overlay Track | core domain | segments, type='overlay' | Holds overlay segments |
| Intro Card | core domain | text, position, style, transition, duration | Overlay type, lives on overlay track |
| Exit Card | core domain | text, position, style, transition, duration | Overlay type, lives on overlay track |
| Title Card | core domain | text, position, style, transition, duration | Overlay type, lives on overlay track |
| Section Divider | core domain | text, position, style, transition, duration | Overlay type, lives on overlay track |
| Text Designer/Canvas | core domain | elements, selectedElement, tool | Renders overlays on video frame |
| Properties Panel | supporting | selectedItem, followMode | Shows segment/overlay properties |
| Follow Mode Toggle | supporting | enabled (boolean), persisted | Controls auto-select during playback |
| Focus Management | supporting | activePanel, keyboardTarget | Routes keyboard events correctly |
| Animation/Transition | core domain | type (fade/slide/typewriter), duration, direction | Applied to overlay in/out |
| Text Style | supporting | fontFamily, fontSize, color | Configures text appearance |
| Background Style | supporting | backgroundColor, opacity | Configures overlay background |
| Position/Transform | supporting | x, y, width, height | Overlay placement on canvas |
| FFmpeg Export Pipeline | supporting | drawtext filters, overlay filters | Burns overlays into final video |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 7 | 7 | - | - | N/A |
| 2 | 8 | 1 | 0 | 7 | 87.5% |
| 3 | 9 | 1 | 1 | 7 | 88.9% |
| 4 | 11 | 2 | 1 | 8 | 81.8% |
| 5 | 15 | 5 | 0 | 9 | 71.4% |
| 6 | 15 | 1 | 0 | 14 | 93.3% |
| 7 | 18 | 3 | 0 | 15 | 83.3% |
| 8 | 19 | 1 | 0 | 18 | 94.7% |
| 9 | 21 | 2 | 0 | 19 | 90.5% |
| 10 | 21 | 0 | 0 | 21 | 100% |

## Interview Transcript
<details>
<summary>Full Q&A (10 rounds)</summary>

### Round 1
**Q:** You've described both bugs (spacebar, arrow key preview, playback-from-frame) and new features (text designer, auto-properties). Which of these is the most critical to get right first — the playback control bugs or the new text designer feature?
**A:** Playback bugs first
**Ambiguity:** 76.5% (Goal: 0.40, Constraints: 0.10, Criteria: 0.10, Context: 0.30)

### Round 2
**Q:** When you press spacebar in the compose view, what exactly happens? Does nothing happen at all, does it toggle once but not resume, does it work only after clicking a specific area, or is it inconsistent?
**A:** Inconsistent behavior — sometimes works, sometimes doesn't
**Ambiguity:** 70.3% (Goal: 0.45, Constraints: 0.10, Criteria: 0.25, Context: 0.35)

### Round 3
**Q:** For the arrow key issue: when you press arrow keys to step through frames, the playhead moves on the timeline but the video preview doesn't update — is that accurate? And for play-from-selected-frame: does pressing play jump back to a different position?
**A:** Both correct — preview doesn't update AND play resumes from wrong position
**Ambiguity:** 59.0% (Goal: 0.55, Constraints: 0.10, Criteria: 0.50, Context: 0.45)

### Round 4 (CONTRARIAN MODE)
**Q:** Do you actually need a visual canvas where you drag text on the video preview, or would a simpler form-based editor with position presets work?
**A:** Visual canvas needed — drag-and-drop on video preview
**Ambiguity:** 55.3% (Goal: 0.60, Constraints: 0.15, Criteria: 0.50, Context: 0.50)

### Round 5
**Q:** You mentioned intros, exits, titles, and sections. Are these four distinct overlay types or are titles/sections just labels within intros/exits?
**A:** Four distinct types — each can appear at different points in the video
**Ambiguity:** 51.0% (Goal: 0.70, Constraints: 0.15, Criteria: 0.50, Context: 0.55)

### Round 6 (SIMPLIFIER MODE)
**Q:** The compose view already has 4 panels. Where should the visual canvas live — replace storyboard, new preset, modal, or inline in preview?
**A:** New 'effects' preset — 5th workspace tab with canvas as main view
**Ambiguity:** 45.5% (Goal: 0.80, Constraints: 0.20, Criteria: 0.50, Context: 0.60)

### Round 7
**Q:** What properties should the user control when placing text on the canvas in the first version?
**A:** Full feature set: text + position + size + font + color + background + opacity + transitions/animation
**Ambiguity:** 38.0% (Goal: 0.85, Constraints: 0.25, Criteria: 0.65, Context: 0.65)

### Round 8
**Q:** How should overlays render — HTML/CSS in editor + FFmpeg for export, Canvas2D for both, or HTML everywhere with screenshot export?
**A:** HTML preview + FFmpeg export — simpler to build, pragmatic choice
**Ambiguity:** 29.8% (Goal: 0.85, Constraints: 0.55, Criteria: 0.65, Context: 0.70)

### Round 9
**Q:** Should Properties auto-follow playhead (override selection), only when nothing selected, or toggle-based? And should overlays be timeline segments with drag handles?
**A:** Follow-mode toggle — button to enable/disable auto-follow. Overlays on overlay track with drag handles.
**Ambiguity:** 21.0% (Goal: 0.90, Constraints: 0.65, Criteria: 0.80, Context: 0.75)

### Round 10
**Q:** What level of test coverage — standard unit/integration, TDD for bugs, regression-focused, or full including E2E?
**A:** Full coverage including E2E (Playwright) tests for the canvas editor
**Ambiguity:** 15.3% (Goal: 0.90, Constraints: 0.80, Criteria: 0.85, Context: 0.80)

</details>
