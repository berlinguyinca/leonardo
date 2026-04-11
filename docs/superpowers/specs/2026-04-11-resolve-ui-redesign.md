# Leonardo — DaVinci Resolve UI Redesign

**Date:** 2026-04-11  
**Status:** Approved  
**Scope:** Visual redesign to DaVinci Resolve aesthetic + bug fixes (thumbnails, playback)

---

## Context

The app currently uses a navy/slate colour palette that feels generic. The user wants a DaVinci Resolve-style professional NLE look: near-black backgrounds, dense layout, a custom toolbar with workspace tabs, and proper transport controls. Two bugs must be fixed in the same pass: thumbnail strips not rendering and playback stopping immediately.

---

## Design Decisions

- **Style reference:** DaVinci Resolve (not macOS chrome — no traffic lights, no native title bar gradient)
- **Toolbar:** Custom 3-zone bar — menu items left, all-caps LEONARDO centre, workspace tabs right
- **Accent colour:** `#4a9eff` (Resolve blue)
- **Approach:** Pure CSS rewrite of `src/renderer/styles/globals.css` + small component changes to `Toolbar.tsx` and `TransportControls.tsx`; no architecture changes

---

## 1. Colour System

Replace all design tokens in `:root`:

| Token | Old value | New value |
|---|---|---|
| `--bg-primary` | `#1a1a2e` | `#111111` |
| `--bg-secondary` | `#16213e` | `#161616` |
| `--bg-panel` | `#1e293b` | `#1a1a1a` |
| `--bg-panel-header` | `#0f172a` | `#141414` |
| `--bg-hover` | `#334155` | `#252525` |
| `--bg-active` | `#3b82f6` | `#1d4a8a` |
| `--text-primary` | `#e2e8f0` | `#d0d0d0` |
| `--text-secondary` | `#94a3b8` | `#888888` |
| `--text-muted` | `#64748b` | `#555555` |
| `--border` | `#334155` | `#252525` |
| `--border-active` | `#3b82f6` | `#4a9eff` |
| `--accent` | `#3b82f6` | `#4a9eff` |
| `--accent-hover` | `#2563eb` | `#3a8eef` |

Add new tokens:
```css
--accent-dim: rgba(74, 158, 255, 0.15);
--accent-border: rgba(74, 158, 255, 0.3);
--segment-video: linear-gradient(180deg, #1d5c9b 0%, #174a7e 100%);
--segment-audio: linear-gradient(180deg, #1a7040 0%, #145a33 100%);
--inset-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.08);
```

Light theme tokens update in parallel (same relative relationships, lighter base).

---

## 2. Toolbar

### Component changes (`src/renderer/components/toolbar/Toolbar.tsx`)

Add a `WorkspaceTabs` sub-component inline. Tabs call the existing `setWorkspacePreset('recording' | 'editing' | 'export')` from `useUIStore` — no new store field needed.

```
Toolbar layout (height: 32px, background: #1a1a1a):
├── Left zone:   File  Edit  View  Playback   (10px #777, gap 16px)
├── Centre zone: LEONARDO                      (700 weight, 12px, letter-spacing 2px, #cccccc)
└── Right zone:  [Record] [Edit] [Export]     (workspace tab pills)
```

**Workspace tab styles:**
- Inactive: `#1e1e1e` bg, `#666` text, 10px font
- Active: `#1d4a8a` bg, `#8ab4f0` text
- Height: 22px, padding: 0 10px, border-radius: 3px
- No border on tabs

**Remove** the current `.toolbar-preset` toggle buttons (replaced by workspace tabs). The `workspacePreset` state and `setWorkspacePreset` action in `useUIStore` are unchanged — only the UI that calls them changes.

---

## 3. Panel Headers

Current headers are tall toggle buttons. Replace with slim info bars:

```css
.panel-header {
  height: 24px;
  background: #141414;
  border-bottom: 1px solid #202020;
  padding: 0 10px;
  display: flex; align-items: center; justify-content: space-between;
}
.panel-header-title {
  font-size: 9px; font-weight: 600;
  color: #555; letter-spacing: 0.6px; text-transform: uppercase;
}
```

Collapse toggle becomes a small `‹` / `›` icon at 12px, colour `#444`.

---

## 4. Transport Controls

### Component changes (`src/renderer/components/timeline/TransportControls.tsx`)

Replace Unicode emoji with SVG path icons. Use `<svg>` elements inside each button — no emoji, no text characters.

**SVG icons to use (all 16×16 viewBox):**
- Go to start: `▐◀` shape — rect + triangle left
- Step back: double left chevron `«`
- Play: right-pointing filled triangle
- Pause: two vertical bars
- Step forward: double right chevron `»`
- Go to end: `▶▌` shape — triangle right + rect

**Button styles:**
```css
.transport-controls {
  display: flex; align-items: center; gap: 4px;
  padding: 0 8px;
}
.transport-btn {
  width: 24px; height: 24px; border-radius: 3px;
  background: rgba(255,255,255,0.06);
  border: none; cursor: pointer; color: #aaa;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.transport-btn:hover { background: rgba(255,255,255,0.12); color: #ddd; }
.transport-btn-play {
  width: 28px; height: 28px; border-radius: 50%;
  background: #4a9eff; color: #fff;
  box-shadow: 0 1px 4px rgba(74,158,255,0.4);
}
.transport-btn-play:hover { background: #3a8eef; }
.transport-time {
  font-size: 11px; color: #4a9eff;
  letter-spacing: 0.5px; font-variant-numeric: tabular-nums;
  margin-left: 8px;
}
```

---

## 5. Timeline

### Timeline container
```css
.timeline-container { background: #111111; }
.timeline-header {
  height: 30px; background: #1a1a1a;
  border-bottom: 1px solid #222;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 0 0;
}
```

### Time ruler
```css
.time-ruler {
  height: 18px; background: #161616;
  border-bottom: 1px solid #1e1e1e;
  cursor: col-resize;
}
.time-ruler-tick { border-left-color: #2a2a2a; }
.time-ruler-tick.major { border-left-color: #383838; }
.time-ruler-label { font-size: 9px; color: #555; }
```

### Track lanes
```css
.track-lane { background: #131313; border-bottom: 1px solid #1c1c1c; }
.track-header { width: 32px; background: #1a1a1a; border-right: 1px solid #222; }
.track-label { font-size: 9px; color: #555; font-weight: 600; }
.track-content { background: #131313; }
```

### Segments
```css
.timeline-segment {
  border-radius: 3px;
  background: var(--segment-video);
  box-shadow: var(--inset-highlight);
  overflow: hidden; position: relative;
}
.timeline-segment.selected {
  box-shadow: 0 0 0 2px #4a9eff, var(--inset-highlight);
}
.timeline-segment:hover:not(.selected) {
  box-shadow: 0 0 0 1px rgba(74,158,255,0.4), var(--inset-highlight);
}
.segment-label {
  position: absolute; bottom: 2px; left: 4px; right: 4px;
  font-size: 9px; color: rgba(255,255,255,0.85);
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  text-shadow: 0 1px 3px rgba(0,0,0,0.9);
  z-index: 1;
}
.segment-edge { background: rgba(255,255,255,0.15); }
```

Audio tracks get a CSS class `.track-audio` applied in `TrackLane.tsx` based on `track.type === 'audio'`:
```css
.track-audio .timeline-segment { background: var(--segment-audio); }
```

---

## 6. Thumbnail Strip (bug fix + styling)

### CSS fix (thumbnails not rendering)
```css
.thumbnail-strip {
  position: absolute; inset: 0;
  display: flex; gap: 1px;
  overflow: hidden; z-index: 0;
  pointer-events: none;
}
.thumbnail-frame {
  flex: 1; height: 100%;
  object-fit: cover; object-position: center;
  opacity: 0.7;
  min-width: 0;
}
```

### IPC audit
Verify `clip:get-thumbnails` handler in `src/main/ipc/clip.ipc.ts` is registered and `extractThumbnails` in `src/main/utils/ffmpeg.ts` correctly returns `file://` URLs. If `clip.duration` is 0 the count calculation breaks — add guard: `if (durationMs <= 0) return []`.

---

## 7. Playback Bug Fix

### Root cause
`usePlayhead.ts` closes over `duration` from the outer scope. If the timeline hasn't loaded when the hook mounts, `duration` is 0 and the tick immediately clamps `newPos >= duration` → stops.

### Fix
Read duration imperatively inside the tick from the store, not from the closed-over value:

```typescript
const tick = (now: number) => {
  const dt = now - lastTime
  lastTime = now
  const { playbackRate, timeline } = useTimelineStore.getState()
  const currentDuration = timeline?.duration ?? 0
  if (currentDuration <= 0) { rafRef.current = requestAnimationFrame(tick); return }
  const newPos = positionRef.current + dt * playbackRate
  const clamped = Math.max(0, Math.min(newPos, currentDuration))
  if (clamped <= 0 || clamped >= currentDuration) {
    setVisualPosition(clamped)
    commitPosition()
    useTimelineStore.getState().setIsPlaying(false)
    useTimelineStore.getState().setPlaybackRate(1)
    return
  }
  setVisualPosition(newPos)
  rafRef.current = requestAnimationFrame(tick)
}
```

Also remove `duration` from the `useEffect` dependency array to prevent re-creating the RAF loop when the timeline loads mid-playback.

---

## 8. Library Panel

```css
.clip-library { background: #111; padding: 6px; }
.clip-card {
  border-radius: 4px; overflow: hidden;
  background: #1a1a1a; margin-bottom: 6px;
  border: 1px solid transparent;
  cursor: pointer; transition: border-color 0.1s;
}
.clip-card:hover { border-color: #333; }
.clip-card.clip-highlighted { border-color: #4a9eff; }

/* Thumbnail area (top 60px of card) */
.clip-card-thumb {
  height: 60px; background: #222; position: relative; overflow: hidden;
}
.clip-card-duration {
  position: absolute; bottom: 4px; right: 4px;
  font-size: 9px; color: rgba(255,255,255,0.8);
  background: rgba(0,0,0,0.6); border-radius: 3px; padding: 1px 4px;
}
.clip-card-label { font-size: 10px; color: #aaa; font-weight: 500; padding: 4px 6px 2px; }
.clip-card-meta { font-size: 9px; color: #555; padding: 0 6px 4px; }
```

The `<div class="clip-card-thumb">` is a styled block — no video or image loading, just a gradient background. Adding async thumbnail loading to the library is out of scope for this pass.

---

## 9. Properties Panel

```css
.properties-form { padding: 8px; }
.properties-section { margin-bottom: 2px; padding: 4px 0; border-bottom: 1px solid #1e1e1e; }
.properties-label { font-size: 9px; color: #555; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }
.properties-value { font-size: 11px; color: #bbb; font-variant-numeric: tabular-nums; }

/* Interactions panel */
.interactions-panel { margin-top: 8px; }
.interactions-title { font-size: 9px; color: #555; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 4px; }
.interaction-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; border-radius: 3px;
  background: #1e1e1e; margin-bottom: 2px;
  cursor: pointer; transition: background 0.1s;
}
.interaction-row:hover { background: #252525; }
.interaction-time { font-size: 9px; color: #4a9eff; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.interaction-tag { font-size: 9px; color: #555; flex-shrink: 0; }
.interaction-label { font-size: 9px; color: #888; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
```

---

## 10. Scroll Container & Playhead

```css
.timeline-scroll-container { background: #111; }
.playhead-head { background: #ff453a; }
.playhead-line { background: #ff453a; }
```

---

## Files Changed

| File | Change type |
|---|---|
| `src/renderer/styles/globals.css` | Replace all design tokens and component styles in-place (same file, complete content replacement) |
| `src/renderer/components/toolbar/Toolbar.tsx` | Add `WorkspaceTabs` component, replace preset toggles |
| `src/renderer/stores/ui-store.ts` | No changes — existing `workspacePreset` / `setWorkspacePreset` reused |
| `src/renderer/components/timeline/TransportControls.tsx` | Replace emoji with inline SVGs |
| `src/renderer/hooks/usePlayhead.ts` | Read duration from store imperatively inside tick |
| `src/renderer/components/timeline/TrackLane.tsx` | Add `.track-audio` class for audio tracks |
| `src/main/utils/ffmpeg.ts` | Guard `durationMs <= 0` in `extractThumbnails` |

---

## Not in scope

- Changing panel layout / split ratios
- Adding new features or panels
- Modifying test files (unless playback fix changes hook behaviour tested)
- Dark/light theme toggle (light theme tokens updated proportionally but not redesigned)

---

## Verification

```bash
npm run dev
# ✓ Toolbar shows LEONARDO centred, menu items left, workspace tabs right
# ✓ Active tab (Edit) highlighted in #1d4a8a
# ✓ Transport controls: 5 flat buttons + round blue play button + blue timecode
# ✓ Transport buttons: SVG icons, no emoji
# ✓ Play button starts/stops playback (RAF loop survives timeline load timing)
# ✓ Ruler drag scrubs playhead continuously
# ✓ Timeline segments: gradient fills, rounded, inset highlight
# ✓ Thumbnails render as image strips inside segments (not invisible)
# ✓ Selected segment shows 2px blue outline
# ✓ Audio track segments are green gradient
# ✓ Library clips have duration badge in corner
# ✓ Properties panel: uppercase labels, tabular-nums values, blue interaction rows
# ✓ Existing shortcuts (Space, J/K/L, Arrows, Cmd+Z) still work

npm test   # all 339 tests pass
```
