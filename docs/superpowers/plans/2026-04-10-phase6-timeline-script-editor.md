# Phase 6: Timeline Editor & Script Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an NLE-style multi-track timeline editor and three-view script editor (Script-Only, Dual-Pane, Inline Timeline) with drag-and-drop, playhead scrubbing, sync point editing, and a properties panel.

**Architecture:** DOM-based React components with CSS transforms for positioning. Tiptap (ProseMirror) for the script editor with custom schema. @dnd-kit for structural reordering, raw pointer events for timeline interactions. Ref-driven playhead with mitt-based emitter. All state flows through existing Zustand + Zundo stores.

**Tech Stack:** React 19, TypeScript strict, Zustand/Zundo, Tiptap, @dnd-kit, mitt, Vitest, React Testing Library

**Design Spec:** `docs/superpowers/specs/2026-04-10-phase6-timeline-script-editor-design.md`

---

## File Structure

### New Files

```
src/renderer/
├── hooks/
│   ├── PlayheadEmitter.ts          — mitt-based event emitter for playhead position
│   ├── usePointerDrag.ts           — generic pointer drag hook with snap and axis constraint
│   ├── usePlayhead.ts              — playhead ref management, scrub, emitter integration
│   ├── useTimelineZoom.ts          — zoom level, Cmd+scroll, cursor-stable zoom
│   ├── useScrollSync.ts            — proportional scroll sync for dual-pane
│   └── useDualPaneSync.ts          — selection-driven bi-directional section ↔ timeline sync
├── components/
│   ├── layout/
│   │   └── ViewModeToggle.tsx      — segmented control: Script | Split | Timeline
│   ├── timeline/
│   │   ├── timeline-utils.ts       — pure functions: timeToPixel, pixelToTime, snap, collision
│   │   ├── Timeline.tsx            — root container: scroll, zoom, renders tracks
│   │   ├── TimeRuler.tsx           — horizontal time scale with tick marks
│   │   ├── Playhead.tsx            — vertical line, ref-driven, pointer scrubbing
│   │   ├── TrackLane.tsx           — single track lane with segments + sync markers
│   │   ├── TrackHeader.tsx         — label, mute/lock toggle buttons
│   │   ├── Segment.tsx             — positioned block, pointer drag/resize
│   │   ├── SyncPointMarker.tsx     — color-coded marker, draggable, edge-resizable
│   │   ├── ZoomControls.tsx        — +/- buttons, zoom level display
│   │   ├── ScrollContainer.tsx     — horizontal scroll wrapper
│   │   ├── InlineTextPopup.tsx     — popup text/voice editor for audio segments
│   │   └── TimelineMinimap.tsx     — compressed timeline for dual-pane
│   ├── script-editor/
│   │   ├── TiptapEditor.tsx        — Tiptap instance with custom schema
│   │   ├── SectionBlock.tsx        — section node view: text, voice dropdown, timing badges
│   │   ├── TimingMarkerChip.tsx    — inline [PAUSE], [ZOOM] decoration
│   │   ├── ScriptOnlyView.tsx      — full script editor view
│   │   ├── DualPaneView.tsx        — side-by-side script + timeline minimap
│   │   ├── InlineEditorView.tsx    — timeline-first view with inline editing
│   │   └── ResizeDivider.tsx       — draggable pane divider
│   └── properties/
│       ├── PropertiesPanel.tsx     — switches between sync point / segment forms
│       ├── SyncPointProperties.tsx — type, duration, coords, annotation, confidence
│       └── SegmentProperties.tsx   — start/end time, source, label

tests/
├── unit/
│   ├── timeline-utils.test.ts      — timeToPixel, pixelToTime, snap, collision
│   ├── playhead-emitter.test.ts    — subscribe, emit, unsubscribe, no leaks
│   └── timeline-zoom.test.ts       — cursor-stable zoom calculations
├── integration/
│   ├── timeline-editor.test.ts     — sync point CRUD, segment interaction, undo/redo
│   ├── script-editor.test.ts       — Tiptap editing, voice assignment, timing markers
│   └── view-mode-switching.test.ts — toolbar toggle, view state persistence
```

### Modified Files

```
src/renderer/stores/ui-store.ts:9       — editorViewMode type already exists as EditorView
src/renderer/components/layout/Toolbar.tsx  — add ViewModeToggle
src/renderer/components/layout/PanelSystem.tsx — wire bottom panel to editor views, right panel to PropertiesPanel
src/renderer/styles/globals.css            — add timeline, script-editor, properties CSS
src/shared/constants.ts                    — add TIMELINE_* constants
package.json                               — add @tiptap/*, @dnd-kit/*, mitt dependencies
vitest.config.ts                           — add jsdom environment for component tests
```

---

## Task 1: Install Dependencies & Configure Test Environment

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Install new dependencies**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities mitt
```

- [ ] **Step 2: Install test dependencies for component testing**

```bash
npm install -D @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Update vitest.config.ts to support both node and jsdom environments**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    testTimeout: 10_000,
    environmentMatchGlobs: [
      ['tests/integration/timeline-editor*', 'jsdom'],
      ['tests/integration/script-editor*', 'jsdom'],
      ['tests/integration/view-mode*', 'jsdom'],
    ],
  },
})
```

Note: removed the top-level `environment: 'node'` so it defaults to `node` for existing tests, and matches `jsdom` for new component tests via `environmentMatchGlobs`.

- [ ] **Step 4: Add timeline constants to shared/constants.ts**

Add to `src/shared/constants.ts`:

```typescript
export const TIMELINE_MIN_ZOOM = 0.1
export const TIMELINE_MAX_ZOOM = 10
export const TIMELINE_DEFAULT_ZOOM = 1
export const TIMELINE_SNAP_THRESHOLD_PX = 10
export const TIMELINE_SEGMENT_MIN_DURATION_MS = 100
export const TIMELINE_EDGE_HIT_ZONE_PX = 6
export const SYNC_POINT_COLORS: Record<string, string> = {
  freeze: '#3b82f6',
  zoom: '#22c55e',
  annotation: '#f59e0b',
  transition: '#a855f7',
}
```

- [ ] **Step 5: Verify existing tests still pass**

Run: `npx vitest run`
Expected: All 155 existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/shared/constants.ts
git commit -m "chore: add Phase 6 dependencies and configure jsdom test environment"
```

---

## Task 2: Timeline Utility Functions (Pure Logic)

**Files:**
- Create: `src/renderer/components/timeline/timeline-utils.ts`
- Create: `tests/unit/timeline-utils.test.ts`

- [ ] **Step 1: Write failing tests for timeToPixel and pixelToTime**

```typescript
// tests/unit/timeline-utils.test.ts
import { describe, it, expect } from 'vitest'
import {
  timeToPixel,
  pixelToTime,
  findSnapTarget,
  detectOverlap,
  getGridInterval,
} from '@renderer/components/timeline/timeline-utils'

describe('timeToPixel', () => {
  it('converts time to pixel at 1x zoom', () => {
    // 100px per second at 1x zoom
    expect(timeToPixel(1000, 1, 0)).toBe(100)
  })

  it('applies zoom multiplier', () => {
    expect(timeToPixel(1000, 2, 0)).toBe(200)
  })

  it('subtracts scroll offset', () => {
    expect(timeToPixel(1000, 1, 50)).toBe(50)
  })

  it('handles zero time', () => {
    expect(timeToPixel(0, 1, 0)).toBe(0)
  })

  it('handles extreme zoom', () => {
    expect(timeToPixel(1000, 10, 0)).toBe(1000)
  })
})

describe('pixelToTime', () => {
  it('converts pixel to time at 1x zoom', () => {
    expect(pixelToTime(100, 1, 0)).toBe(1000)
  })

  it('applies zoom divisor', () => {
    expect(pixelToTime(200, 2, 0)).toBe(1000)
  })

  it('adds scroll offset', () => {
    expect(pixelToTime(50, 1, 50)).toBe(1000)
  })

  it('handles zero pixel', () => {
    expect(pixelToTime(0, 1, 0)).toBe(0)
  })

  it('is inverse of timeToPixel', () => {
    const time = 5000
    const zoom = 2.5
    const scroll = 100
    const px = timeToPixel(time, zoom, scroll)
    expect(pixelToTime(px, zoom, scroll)).toBeCloseTo(time)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/timeline-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement timeToPixel and pixelToTime**

```typescript
// src/renderer/components/timeline/timeline-utils.ts

const PIXELS_PER_SECOND = 100

/**
 * Convert a time in milliseconds to a pixel position.
 */
export function timeToPixel(timeMs: number, zoom: number, scrollOffset: number): number {
  return (timeMs / 1000) * PIXELS_PER_SECOND * zoom - scrollOffset
}

/**
 * Convert a pixel position back to a time in milliseconds.
 */
export function pixelToTime(px: number, zoom: number, scrollOffset: number): number {
  return ((px + scrollOffset) / (PIXELS_PER_SECOND * zoom)) * 1000
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/timeline-utils.test.ts`
Expected: PASS (5 + 5 tests)

- [ ] **Step 5: Write failing tests for findSnapTarget**

Add to `tests/unit/timeline-utils.test.ts`:

```typescript
describe('findSnapTarget', () => {
  it('snaps to nearest target within threshold', () => {
    const targets = [1000, 3000, 5000]
    const result = findSnapTarget(1005, targets, 10)
    expect(result).toBe(1000)
  })

  it('returns null when no target within threshold', () => {
    const targets = [1000, 3000, 5000]
    const result = findSnapTarget(2000, targets, 10)
    expect(result).toBeNull()
  })

  it('snaps to closest when multiple in range', () => {
    const targets = [1000, 1008]
    const result = findSnapTarget(1003, targets, 10)
    expect(result).toBe(1000) // 3px away vs 5px away
  })

  it('handles empty targets', () => {
    const result = findSnapTarget(1000, [], 10)
    expect(result).toBeNull()
  })

  it('snaps to exact match', () => {
    const targets = [1000, 2000]
    const result = findSnapTarget(2000, targets, 10)
    expect(result).toBe(2000)
  })
})
```

- [ ] **Step 6: Implement findSnapTarget**

Add to `src/renderer/components/timeline/timeline-utils.ts`:

```typescript
import { TIMELINE_SNAP_THRESHOLD_PX } from '@shared/constants'

/**
 * Find the closest snap target within a pixel threshold.
 * Returns the target value or null if none is close enough.
 */
export function findSnapTarget(
  position: number,
  targets: number[],
  threshold: number = TIMELINE_SNAP_THRESHOLD_PX,
): number | null {
  let closest: number | null = null
  let closestDist = Infinity

  for (const target of targets) {
    const dist = Math.abs(position - target)
    if (dist <= threshold && dist < closestDist) {
      closest = target
      closestDist = dist
    }
  }

  return closest
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/unit/timeline-utils.test.ts`
Expected: PASS (all snap tests)

- [ ] **Step 8: Write failing tests for detectOverlap and getGridInterval**

Add to `tests/unit/timeline-utils.test.ts`:

```typescript
describe('detectOverlap', () => {
  it('detects overlapping segments', () => {
    const segment = { startTime: 1000, endTime: 3000 }
    const others = [
      { id: 's1', startTime: 2000, endTime: 4000 },
      { id: 's2', startTime: 5000, endTime: 6000 },
    ]
    const result = detectOverlap(segment, others)
    expect(result).toEqual(['s1'])
  })

  it('returns empty for non-overlapping', () => {
    const segment = { startTime: 1000, endTime: 2000 }
    const others = [
      { id: 's1', startTime: 3000, endTime: 4000 },
    ]
    const result = detectOverlap(segment, others)
    expect(result).toEqual([])
  })

  it('detects full containment', () => {
    const segment = { startTime: 1000, endTime: 5000 }
    const others = [
      { id: 's1', startTime: 2000, endTime: 3000 },
    ]
    const result = detectOverlap(segment, others)
    expect(result).toEqual(['s1'])
  })

  it('does not count touching edges as overlap', () => {
    const segment = { startTime: 1000, endTime: 2000 }
    const others = [
      { id: 's1', startTime: 2000, endTime: 3000 },
    ]
    const result = detectOverlap(segment, others)
    expect(result).toEqual([])
  })

  it('handles empty others', () => {
    const segment = { startTime: 1000, endTime: 2000 }
    const result = detectOverlap(segment, [])
    expect(result).toEqual([])
  })
})

describe('getGridInterval', () => {
  it('returns 500ms at 1x zoom', () => {
    expect(getGridInterval(1)).toBe(500)
  })

  it('returns 100ms at 5x zoom', () => {
    expect(getGridInterval(5)).toBe(100)
  })

  it('returns 1000ms at 0.5x zoom', () => {
    expect(getGridInterval(0.5)).toBe(1000)
  })

  it('returns 2000ms at 0.25x zoom', () => {
    expect(getGridInterval(0.25)).toBe(2000)
  })

  it('returns 50ms at 10x zoom', () => {
    expect(getGridInterval(10)).toBe(50)
  })
})
```

- [ ] **Step 9: Implement detectOverlap and getGridInterval**

Add to `src/renderer/components/timeline/timeline-utils.ts`:

```typescript
interface TimeRange {
  startTime: number
  endTime: number
}

interface IdentifiedTimeRange extends TimeRange {
  id: string
}

/**
 * Returns IDs of segments that overlap with the given time range.
 * Touching edges (startA === endB) are not considered overlapping.
 */
export function detectOverlap(
  segment: TimeRange,
  others: IdentifiedTimeRange[],
): string[] {
  return others
    .filter((other) => segment.startTime < other.endTime && segment.endTime > other.startTime)
    .map((other) => other.id)
}

/**
 * Returns the grid snap interval in ms based on zoom level.
 * Higher zoom = finer grid.
 */
export function getGridInterval(zoom: number): number {
  const base = 500 // 500ms at 1x
  return Math.max(50, Math.round(base / zoom))
}
```

- [ ] **Step 10: Run all tests to verify**

Run: `npx vitest run tests/unit/timeline-utils.test.ts`
Expected: PASS (all tests)

- [ ] **Step 11: Commit**

```bash
git add src/renderer/components/timeline/timeline-utils.ts tests/unit/timeline-utils.test.ts
git commit -m "feat: add timeline utility functions (timeToPixel, snap, collision, grid)"
```

---

## Task 3: PlayheadEmitter

**Files:**
- Create: `src/renderer/hooks/PlayheadEmitter.ts`
- Create: `tests/unit/playhead-emitter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/playhead-emitter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playheadEmitter } from '@renderer/hooks/PlayheadEmitter'

describe('PlayheadEmitter', () => {
  beforeEach(() => {
    playheadEmitter.all.clear()
  })

  it('emits position to subscribers', () => {
    const handler = vi.fn()
    playheadEmitter.on('position', handler)
    playheadEmitter.emit('position', 5000)
    expect(handler).toHaveBeenCalledWith(5000)
  })

  it('supports multiple subscribers', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    playheadEmitter.on('position', h1)
    playheadEmitter.on('position', h2)
    playheadEmitter.emit('position', 3000)
    expect(h1).toHaveBeenCalledWith(3000)
    expect(h2).toHaveBeenCalledWith(3000)
  })

  it('stops receiving after unsubscribe', () => {
    const handler = vi.fn()
    playheadEmitter.on('position', handler)
    playheadEmitter.off('position', handler)
    playheadEmitter.emit('position', 1000)
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not leak between tests when cleared', () => {
    // If prior test subscriber leaked, this would fail
    const handler = vi.fn()
    playheadEmitter.emit('position', 999)
    expect(handler).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/playhead-emitter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PlayheadEmitter**

```typescript
// src/renderer/hooks/PlayheadEmitter.ts
import mitt from 'mitt'

type PlayheadEvents = {
  position: number
}

export const playheadEmitter = mitt<PlayheadEvents>()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/playhead-emitter.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/PlayheadEmitter.ts tests/unit/playhead-emitter.test.ts
git commit -m "feat: add PlayheadEmitter (mitt-based event bus for playhead position)"
```

---

## Task 4: usePointerDrag Hook

**Files:**
- Create: `src/renderer/hooks/usePointerDrag.ts`

- [ ] **Step 1: Implement usePointerDrag**

```typescript
// src/renderer/hooks/usePointerDrag.ts
import { useCallback, useRef } from 'react'

export interface PointerDragOptions {
  /** Called on each pointer move with the delta from start */
  onDrag: (dx: number, dy: number, clientX: number, clientY: number) => void
  /** Called when pointer is released */
  onDragEnd: (dx: number, dy: number) => void
  /** Called when drag starts */
  onDragStart?: (clientX: number, clientY: number) => void
  /** Constrain to 'x' or 'y' axis only */
  axis?: 'x' | 'y'
  /** Minimum px movement before drag starts (dead zone) */
  threshold?: number
}

export function usePointerDrag(options: PointerDragOptions) {
  const startPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const hasStarted = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    startPos.current = { x: e.clientX, y: e.clientY }
    isDragging.current = true
    hasStarted.current = false

    const threshold = optionsRef.current.threshold ?? 0

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return

      let dx = e.clientX - startPos.current.x
      let dy = e.clientY - startPos.current.y

      if (!hasStarted.current) {
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return
        hasStarted.current = true
        optionsRef.current.onDragStart?.(startPos.current.x, startPos.current.y)
      }

      if (optionsRef.current.axis === 'x') dy = 0
      if (optionsRef.current.axis === 'y') dx = 0

      optionsRef.current.onDrag(dx, dy, e.clientX, e.clientY)
    }

    const handlePointerUp = (e: PointerEvent) => {
      isDragging.current = false
      let dx = e.clientX - startPos.current.x
      let dy = e.clientY - startPos.current.y
      if (optionsRef.current.axis === 'x') dy = 0
      if (optionsRef.current.axis === 'y') dx = 0

      if (hasStarted.current) {
        optionsRef.current.onDragEnd(dx, dy)
      }

      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
    }

    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
  }, [])

  return { onPointerDown: handlePointerDown }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/usePointerDrag.ts
git commit -m "feat: add usePointerDrag hook for timeline drag interactions"
```

---

## Task 5: usePlayhead Hook

**Files:**
- Create: `src/renderer/hooks/usePlayhead.ts`

- [ ] **Step 1: Implement usePlayhead**

```typescript
// src/renderer/hooks/usePlayhead.ts
import { useCallback, useRef, useEffect } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import { playheadEmitter } from './PlayheadEmitter'

export function usePlayhead() {
  const playheadRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef(0)
  const rafRef = useRef<number>(0)

  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const setPlayheadPosition = useTimelineStore((s) => s.setPlayheadPosition)
  const duration = useTimelineStore((s) => s.timeline?.duration ?? 0)

  /** Move the playhead DOM element without triggering React re-renders */
  const setVisualPosition = useCallback((timeMs: number) => {
    positionRef.current = timeMs
    playheadEmitter.emit('position', timeMs)
  }, [])

  /** Commit the current position to the store (for undo/redo, persistence) */
  const commitPosition = useCallback(() => {
    setPlayheadPosition(positionRef.current)
  }, [setPlayheadPosition])

  /** Seek to a specific time */
  const seekTo = useCallback((timeMs: number) => {
    const clamped = Math.max(0, Math.min(timeMs, duration))
    setVisualPosition(clamped)
    setPlayheadPosition(clamped)
  }, [duration, setVisualPosition, setPlayheadPosition])

  /** Playback loop */
  useEffect(() => {
    if (!isPlaying) return

    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = now - lastTime
      lastTime = now
      const newPos = positionRef.current + dt
      if (newPos >= duration) {
        setVisualPosition(duration)
        commitPosition()
        useTimelineStore.getState().setIsPlaying(false)
        return
      }
      setVisualPosition(newPos)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, duration, setVisualPosition, commitPosition])

  return {
    playheadRef,
    positionRef,
    setVisualPosition,
    commitPosition,
    seekTo,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/usePlayhead.ts
git commit -m "feat: add usePlayhead hook (ref-driven playback, emitter sync)"
```

---

## Task 6: useTimelineZoom Hook

**Files:**
- Create: `src/renderer/hooks/useTimelineZoom.ts`
- Create: `tests/unit/timeline-zoom.test.ts`

- [ ] **Step 1: Write failing tests for cursor-stable zoom math**

```typescript
// tests/unit/timeline-zoom.test.ts
import { describe, it, expect } from 'vitest'
import { computeZoomScrollOffset } from '@renderer/hooks/useTimelineZoom'

describe('computeZoomScrollOffset', () => {
  it('keeps cursor position stable when zooming in', () => {
    // At zoom 1, scroll 0, cursor at px 200 → time = 2000ms
    // Zoom to 2x: time 2000ms should still be at px 200
    // New scroll = timeToPixel(2000, 2, 0) - 200 = 400 - 200 = 200
    const result = computeZoomScrollOffset(200, 0, 1, 2)
    expect(result).toBe(200)
  })

  it('keeps cursor position stable when zooming out', () => {
    // At zoom 2, scroll 200, cursor at px 200 → time = (200+200)/(100*2)*1000 = 2000ms
    // Zoom to 1: timeToPixel(2000, 1, 0) = 200. New scroll = 200 - 200 = 0
    const result = computeZoomScrollOffset(200, 200, 2, 1)
    expect(result).toBe(0)
  })

  it('returns 0 when result would be negative', () => {
    const result = computeZoomScrollOffset(50, 0, 2, 1)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('handles extreme zoom values', () => {
    const result = computeZoomScrollOffset(500, 0, 1, 10)
    expect(result).toBe(4500) // (500/100)*1000 = 5000ms → at 10x: 5000px - 500 = 4500
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/timeline-zoom.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useTimelineZoom with computeZoomScrollOffset**

```typescript
// src/renderer/hooks/useTimelineZoom.ts
import { useCallback, useRef } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import { TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM } from '@shared/constants'
import { pixelToTime, timeToPixel } from '../components/timeline/timeline-utils'

/**
 * Compute the new scroll offset to keep the cursor position stable after a zoom change.
 */
export function computeZoomScrollOffset(
  cursorPx: number,
  currentScroll: number,
  oldZoom: number,
  newZoom: number,
): number {
  const timeAtCursor = pixelToTime(cursorPx, oldZoom, currentScroll)
  const newPxAtTime = timeToPixel(timeAtCursor, newZoom, 0)
  return Math.max(0, newPxAtTime - cursorPx)
}

export function useTimelineZoom(scrollRef: React.RefObject<HTMLDivElement | null>) {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const setZoomLevel = useTimelineStore((s) => s.setZoomLevel)
  const scrollOffsetRef = useRef(0)

  const zoom = useCallback(
    (direction: 'in' | 'out', cursorPx?: number) => {
      const oldZoom = useTimelineStore.getState().zoomLevel
      const factor = direction === 'in' ? 1.2 : 1 / 1.2
      const newZoom = Math.max(TIMELINE_MIN_ZOOM, Math.min(TIMELINE_MAX_ZOOM, oldZoom * factor))

      if (cursorPx !== undefined && scrollRef.current) {
        const currentScroll = scrollRef.current.scrollLeft
        const newScroll = computeZoomScrollOffset(cursorPx, currentScroll, oldZoom, newZoom)
        scrollOffsetRef.current = newScroll
        scrollRef.current.scrollLeft = newScroll
      }

      setZoomLevel(newZoom)
    },
    [setZoomLevel, scrollRef],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const cursorPx = e.clientX - rect.left
      zoom(e.deltaY < 0 ? 'in' : 'out', cursorPx)
    },
    [zoom],
  )

  return { zoomLevel, zoom, handleWheel, scrollOffsetRef }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/timeline-zoom.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/useTimelineZoom.ts tests/unit/timeline-zoom.test.ts
git commit -m "feat: add useTimelineZoom hook with cursor-stable zoom math"
```

---

## Task 7: ViewModeToggle Component + Toolbar Integration

**Files:**
- Create: `src/renderer/components/layout/ViewModeToggle.tsx`
- Modify: `src/renderer/components/layout/Toolbar.tsx`
- Modify: `src/renderer/styles/globals.css`

- [ ] **Step 1: Create ViewModeToggle component**

```tsx
// src/renderer/components/layout/ViewModeToggle.tsx
import { useEffect } from 'react'
import { useUIStore } from '../../stores/ui-store'
import type { EditorView } from '../../stores/ui-store'

const VIEWS: { key: EditorView; label: string }[] = [
  { key: 'script-only', label: 'Script' },
  { key: 'dual-pane', label: 'Split' },
  { key: 'inline', label: 'Timeline' },
]

export function ViewModeToggle(): React.ReactNode {
  const editorView = useUIStore((s) => s.editorView)
  const setEditorView = useUIStore((s) => s.setEditorView)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const index = parseInt(e.key, 10)
      if (index >= 1 && index <= 3) {
        e.preventDefault()
        setEditorView(VIEWS[index - 1].key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setEditorView])

  return (
    <div className="view-mode-toggle" role="tablist" aria-label="Editor view">
      {VIEWS.map(({ key, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={editorView === key}
          className={`view-mode-btn ${editorView === key ? 'active' : ''}`}
          onClick={() => setEditorView(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Integrate ViewModeToggle into Toolbar**

In `src/renderer/components/layout/Toolbar.tsx`, add the import and render the toggle in the toolbar-right section:

```tsx
// Add import at top:
import { ViewModeToggle } from './ViewModeToggle'

// Replace the toolbar-right div:
      <div className="toolbar-right">
        <ViewModeToggle />
        <button
          className="toolbar-btn toolbar-theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>
```

- [ ] **Step 3: Add CSS for ViewModeToggle**

Add to `src/renderer/styles/globals.css`:

```css
/* View Mode Toggle */
.view-mode-toggle {
  display: flex;
  gap: 0;
  background: var(--bg-secondary);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid var(--border);
}

.view-mode-btn {
  padding: 4px 14px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.15s;
}

.view-mode-btn:hover {
  color: var(--text-primary);
}

.view-mode-btn.active {
  background: var(--accent);
  color: white;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/layout/ViewModeToggle.tsx src/renderer/components/layout/Toolbar.tsx src/renderer/styles/globals.css
git commit -m "feat: add ViewModeToggle segmented control in Toolbar (Cmd+1/2/3)"
```

---

## Task 8: Timeline Core Components (TimeRuler, Playhead, ScrollContainer, ZoomControls)

**Files:**
- Create: `src/renderer/components/timeline/TimeRuler.tsx`
- Create: `src/renderer/components/timeline/Playhead.tsx`
- Create: `src/renderer/components/timeline/ScrollContainer.tsx`
- Create: `src/renderer/components/timeline/ZoomControls.tsx`
- Modify: `src/renderer/styles/globals.css`

- [ ] **Step 1: Create TimeRuler**

```tsx
// src/renderer/components/timeline/TimeRuler.tsx
import { useMemo } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { timeToPixel, getGridInterval } from './timeline-utils'

interface TimeRulerProps {
  scrollOffset: number
  visibleWidth: number
  onSeek: (timeMs: number) => void
}

export function TimeRuler({ scrollOffset, visibleWidth, onSeek }: TimeRulerProps): React.ReactNode {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const duration = useTimelineStore((s) => s.timeline?.duration ?? 0)

  const ticks = useMemo(() => {
    const interval = getGridInterval(zoomLevel)
    const result: { timeMs: number; px: number; major: boolean }[] = []
    const startTime = Math.max(0, Math.floor(pixelToTimeLocal(scrollOffset, zoomLevel) / interval) * interval)

    for (let t = startTime; t <= duration; t += interval) {
      const px = timeToPixel(t, zoomLevel, scrollOffset)
      if (px < -50) continue
      if (px > visibleWidth + 50) break
      result.push({ timeMs: t, px, major: t % (interval * 5) === 0 })
    }
    return result
  }, [zoomLevel, duration, scrollOffset, visibleWidth])

  function pixelToTimeLocal(px: number, zoom: number): number {
    return (px / (100 * zoom)) * 1000
  }

  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const fraction = Math.round((ms % 1000) / 100)
    if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, '0')}.${fraction}`
    return `${seconds}.${fraction}s`
  }

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const timeMs = pixelToTimeLocal(px + scrollOffset, zoomLevel)
    onSeek(Math.max(0, timeMs))
  }

  return (
    <div className="time-ruler" onClick={handleClick}>
      {ticks.map((tick) => (
        <div
          key={tick.timeMs}
          className={`time-ruler-tick ${tick.major ? 'major' : 'minor'}`}
          style={{ left: tick.px }}
        >
          {tick.major && <span className="time-ruler-label">{formatTime(tick.timeMs)}</span>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create Playhead**

```tsx
// src/renderer/components/timeline/Playhead.tsx
import { useEffect, useRef } from 'react'
import { playheadEmitter } from '../../hooks/PlayheadEmitter'
import { useTimelineStore } from '../../stores/timeline-store'
import { timeToPixel } from './timeline-utils'

interface PlayheadProps {
  scrollOffset: number
}

export function Playhead({ scrollOffset }: PlayheadProps): React.ReactNode {
  const lineRef = useRef<HTMLDivElement>(null)
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const storedPosition = useTimelineStore((s) => s.playheadPosition)

  useEffect(() => {
    // Sync from store on mount and when not playing
    const px = timeToPixel(storedPosition, zoomLevel, scrollOffset)
    if (lineRef.current) {
      lineRef.current.style.transform = `translateX(${px}px)`
    }
  }, [storedPosition, zoomLevel, scrollOffset])

  useEffect(() => {
    const handler = (timeMs: number) => {
      if (!lineRef.current) return
      const px = timeToPixel(timeMs, zoomLevel, scrollOffset)
      lineRef.current.style.transform = `translateX(${px}px)`
    }
    playheadEmitter.on('position', handler)
    return () => { playheadEmitter.off('position', handler) }
  }, [zoomLevel, scrollOffset])

  return (
    <div className="playhead" ref={lineRef}>
      <div className="playhead-head" />
      <div className="playhead-line" />
    </div>
  )
}
```

- [ ] **Step 3: Create ScrollContainer**

```tsx
// src/renderer/components/timeline/ScrollContainer.tsx
import { forwardRef, useCallback, type ReactNode } from 'react'

interface ScrollContainerProps {
  children: ReactNode
  totalWidth: number
  onScroll: (scrollLeft: number) => void
  onWheel: (e: React.WheelEvent) => void
}

export const ScrollContainer = forwardRef<HTMLDivElement, ScrollContainerProps>(
  function ScrollContainer({ children, totalWidth, onScroll, onWheel }, ref) {
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        onScroll((e.currentTarget as HTMLDivElement).scrollLeft)
      },
      [onScroll],
    )

    return (
      <div
        className="timeline-scroll-container"
        ref={ref}
        onScroll={handleScroll}
        onWheel={onWheel}
      >
        <div className="timeline-scroll-content" style={{ width: totalWidth }}>
          {children}
        </div>
      </div>
    )
  },
)
```

- [ ] **Step 4: Create ZoomControls**

```tsx
// src/renderer/components/timeline/ZoomControls.tsx
import { useTimelineStore } from '../../stores/timeline-store'

interface ZoomControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
}

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps): React.ReactNode {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)

  return (
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={onZoomOut} aria-label="Zoom out">-</button>
      <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
      <button className="zoom-btn" onClick={onZoomIn} aria-label="Zoom in">+</button>
    </div>
  )
}
```

- [ ] **Step 5: Add CSS for timeline core components**

Add to `src/renderer/styles/globals.css`:

```css
/* Timeline */
.timeline-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--bg-panel-header);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.timeline-scroll-container {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  position: relative;
}

.timeline-scroll-content {
  position: relative;
  min-height: 100%;
}

/* Time Ruler */
.time-ruler {
  height: 24px;
  position: relative;
  background: var(--bg-panel-header);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  flex-shrink: 0;
}

.time-ruler-tick {
  position: absolute;
  top: 0;
  width: 1px;
  background: var(--border);
}

.time-ruler-tick.major {
  height: 16px;
  background: var(--text-muted);
}

.time-ruler-tick.minor {
  height: 8px;
  top: 8px;
}

.time-ruler-label {
  position: absolute;
  top: 0;
  left: 4px;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  user-select: none;
}

/* Playhead */
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  z-index: 50;
  pointer-events: none;
}

.playhead-head {
  width: 12px;
  height: 12px;
  background: var(--danger);
  border-radius: 2px 2px 50% 50%;
  position: absolute;
  top: 0;
  left: -6px;
}

.playhead-line {
  position: absolute;
  top: 12px;
  bottom: 0;
  left: 0;
  width: 1px;
  background: var(--danger);
}

/* Zoom Controls */
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.zoom-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-panel);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.zoom-btn:hover {
  background: var(--bg-hover);
}

.zoom-level {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 40px;
  text-align: center;
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/timeline/TimeRuler.tsx src/renderer/components/timeline/Playhead.tsx src/renderer/components/timeline/ScrollContainer.tsx src/renderer/components/timeline/ZoomControls.tsx src/renderer/styles/globals.css
git commit -m "feat: add timeline core components (TimeRuler, Playhead, ScrollContainer, ZoomControls)"
```

---

## Task 9: TrackHeader, TrackLane, Segment, SyncPointMarker

**Files:**
- Create: `src/renderer/components/timeline/TrackHeader.tsx`
- Create: `src/renderer/components/timeline/TrackLane.tsx`
- Create: `src/renderer/components/timeline/Segment.tsx`
- Create: `src/renderer/components/timeline/SyncPointMarker.tsx`
- Modify: `src/renderer/styles/globals.css`

- [ ] **Step 1: Create TrackHeader**

```tsx
// src/renderer/components/timeline/TrackHeader.tsx
import type { Track } from '@shared/types'

interface TrackHeaderProps {
  track: Track
  onToggleMute: () => void
  onToggleLock: () => void
}

export function TrackHeader({ track, onToggleMute, onToggleLock }: TrackHeaderProps): React.ReactNode {
  return (
    <div className="track-header">
      <span className="track-label">{track.label}</span>
      <div className="track-header-controls">
        <button
          className={`track-header-btn ${track.muted ? 'active' : ''}`}
          onClick={onToggleMute}
          aria-label={track.muted ? 'Unmute' : 'Mute'}
          title={track.muted ? 'Unmute' : 'Mute'}
        >
          M
        </button>
        <button
          className={`track-header-btn ${track.locked ? 'active' : ''}`}
          onClick={onToggleLock}
          aria-label={track.locked ? 'Unlock' : 'Lock'}
          title={track.locked ? 'Unlock' : 'Lock'}
        >
          L
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Segment**

```tsx
// src/renderer/components/timeline/Segment.tsx
import { useCallback } from 'react'
import type { Segment as SegmentType } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { usePointerDrag } from '../../hooks/usePointerDrag'
import { timeToPixel, pixelToTime, findSnapTarget } from './timeline-utils'
import { TIMELINE_EDGE_HIT_ZONE_PX, TIMELINE_SEGMENT_MIN_DURATION_MS } from '@shared/constants'

interface SegmentProps {
  segment: SegmentType
  zoomLevel: number
  scrollOffset: number
  snapTargets: number[]
}

export function Segment({ segment, zoomLevel, scrollOffset, snapTargets }: SegmentProps): React.ReactNode {
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)
  const setSelectedSegment = useTimelineStore((s) => s.setSelectedSegment)
  const isSelected = selectedSegmentId === segment.id

  const left = timeToPixel(segment.startTime, zoomLevel, scrollOffset)
  const width = timeToPixel(segment.endTime, zoomLevel, scrollOffset) - left

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedSegment(segment.id)
    },
    [segment.id, setSelectedSegment],
  )

  const { onPointerDown } = usePointerDrag({
    axis: 'x',
    threshold: 3,
    onDrag: () => {
      // Visual feedback handled via CSS class during drag
    },
    onDragEnd: () => {
      // Commit position update to store
    },
  })

  return (
    <div
      className={`timeline-segment ${isSelected ? 'selected' : ''}`}
      style={{ left, width: Math.max(width, 4) }}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      data-segment-id={segment.id}
    >
      <div className="segment-label">{segment.label}</div>
      <div className="segment-edge segment-edge-left" />
      <div className="segment-edge segment-edge-right" />
    </div>
  )
}
```

- [ ] **Step 3: Create SyncPointMarker**

```tsx
// src/renderer/components/timeline/SyncPointMarker.tsx
import { useCallback } from 'react'
import type { SyncPoint } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { usePointerDrag } from '../../hooks/usePointerDrag'
import { timeToPixel } from './timeline-utils'
import { SYNC_POINT_COLORS } from '@shared/constants'

interface SyncPointMarkerProps {
  syncPoint: SyncPoint
  zoomLevel: number
  scrollOffset: number
}

export function SyncPointMarker({ syncPoint, zoomLevel, scrollOffset }: SyncPointMarkerProps): React.ReactNode {
  const selectedSyncPointId = useTimelineStore((s) => s.selectedSyncPointId)
  const setSelectedSyncPoint = useTimelineStore((s) => s.setSelectedSyncPoint)
  const updateSyncPoint = useTimelineStore((s) => s.updateSyncPoint)
  const isSelected = selectedSyncPointId === syncPoint.id

  const left = timeToPixel(syncPoint.timestamp, zoomLevel, scrollOffset)
  const width = syncPoint.duration > 0
    ? timeToPixel(syncPoint.timestamp + syncPoint.duration, zoomLevel, scrollOffset) - left
    : 8 // point-in-time markers get a minimum width
  const color = SYNC_POINT_COLORS[syncPoint.type] ?? '#888'

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedSyncPoint(syncPoint.id)
    },
    [syncPoint.id, setSelectedSyncPoint],
  )

  const { onPointerDown } = usePointerDrag({
    axis: 'x',
    threshold: 3,
    onDrag: () => {
      // Visual feedback
    },
    onDragEnd: (dx) => {
      const pxPerMs = (100 * zoomLevel) / 1000
      const deltaMs = dx / pxPerMs
      updateSyncPoint(syncPoint.id, {
        timestamp: Math.max(0, syncPoint.timestamp + deltaMs),
      })
    },
  })

  const hasDuration = syncPoint.type === 'freeze' || syncPoint.type === 'zoom'

  return (
    <div
      className={`sync-point-marker ${isSelected ? 'selected' : ''}`}
      style={{ left, width: Math.max(width, 8), backgroundColor: color }}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      data-sync-point-id={syncPoint.id}
      title={`${syncPoint.type} (${syncPoint.source})`}
    >
      {hasDuration && <div className="sync-point-edge sync-point-edge-right" />}
    </div>
  )
}
```

- [ ] **Step 4: Create TrackLane**

```tsx
// src/renderer/components/timeline/TrackLane.tsx
import type { Track, SyncPoint } from '@shared/types'
import { TrackHeader } from './TrackHeader'
import { Segment } from './Segment'
import { SyncPointMarker } from './SyncPointMarker'

interface TrackLaneProps {
  track: Track
  syncPoints: SyncPoint[]
  zoomLevel: number
  scrollOffset: number
  onToggleMute: () => void
  onToggleLock: () => void
}

export function TrackLane({
  track,
  syncPoints,
  zoomLevel,
  scrollOffset,
  onToggleMute,
  onToggleLock,
}: TrackLaneProps): React.ReactNode {
  const snapTargets = track.segments.flatMap((s) => [s.startTime, s.endTime])

  return (
    <div className="track-lane" data-track-id={track.id}>
      <TrackHeader track={track} onToggleMute={onToggleMute} onToggleLock={onToggleLock} />
      <div className="track-content">
        {track.segments.map((seg) => (
          <Segment
            key={seg.id}
            segment={seg}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
            snapTargets={snapTargets}
          />
        ))}
        {syncPoints.map((sp) => (
          <SyncPointMarker
            key={sp.id}
            syncPoint={sp}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add CSS for track components**

Add to `src/renderer/styles/globals.css`:

```css
/* Track Lanes */
.track-lane {
  display: flex;
  border-bottom: 1px solid var(--border);
  min-height: 48px;
}

.track-header {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--bg-panel-header);
  border-right: 1px solid var(--border);
}

.track-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-header-controls {
  display: flex;
  gap: 2px;
}

.track-header-btn {
  width: 20px;
  height: 20px;
  font-size: 9px;
  font-weight: 700;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.track-header-btn:hover {
  background: var(--bg-hover);
}

.track-header-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.track-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Segments */
.timeline-segment {
  position: absolute;
  top: 4px;
  height: calc(100% - 8px);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: grab;
  display: flex;
  align-items: center;
  overflow: hidden;
  transition: border-color 0.1s;
}

.timeline-segment:hover {
  border-color: var(--text-muted);
}

.timeline-segment.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.segment-label {
  padding: 0 6px;
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}

.segment-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
}

.segment-edge-left { left: 0; }
.segment-edge-right { right: 0; }

/* Sync Point Markers */
.sync-point-marker {
  position: absolute;
  top: 2px;
  height: calc(100% - 4px);
  border-radius: 2px;
  cursor: grab;
  opacity: 0.8;
  transition: opacity 0.1s;
  z-index: 10;
}

.sync-point-marker:hover {
  opacity: 1;
}

.sync-point-marker.selected {
  opacity: 1;
  box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor;
}

.sync-point-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
}

.sync-point-edge-right { right: 0; }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/timeline/TrackHeader.tsx src/renderer/components/timeline/TrackLane.tsx src/renderer/components/timeline/Segment.tsx src/renderer/components/timeline/SyncPointMarker.tsx src/renderer/styles/globals.css
git commit -m "feat: add track components (TrackHeader, TrackLane, Segment, SyncPointMarker)"
```

---

## Task 10: Timeline Container + PanelSystem Wiring

**Files:**
- Create: `src/renderer/components/timeline/Timeline.tsx`
- Modify: `src/renderer/components/layout/PanelSystem.tsx`

- [ ] **Step 1: Create Timeline container**

```tsx
// src/renderer/components/timeline/Timeline.tsx
import { useCallback, useRef, useState } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { usePlayhead } from '../../hooks/usePlayhead'
import { useTimelineZoom } from '../../hooks/useTimelineZoom'
import { timeToPixel } from './timeline-utils'
import { TimeRuler } from './TimeRuler'
import { Playhead } from './Playhead'
import { TrackLane } from './TrackLane'
import { ScrollContainer } from './ScrollContainer'
import { ZoomControls } from './ZoomControls'

export function Timeline(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [visibleWidth, setVisibleWidth] = useState(800)

  const { seekTo } = usePlayhead()
  const { zoom, handleWheel } = useTimelineZoom(scrollRef)

  const duration = timeline?.duration ?? 0
  const totalWidth = timeToPixel(duration, zoomLevel, 0) + 200 // 200px padding

  const handleScroll = useCallback((scrollLeft: number) => {
    setScrollOffset(scrollLeft)
  }, [])

  const handleDeselect = useCallback(() => {
    useTimelineStore.getState().setSelectedSyncPoint(null)
    useTimelineStore.getState().setSelectedSegment(null)
  }, [])

  if (!timeline) {
    return (
      <div className="timeline-container">
        <div className="panel-placeholder">No timeline loaded</div>
      </div>
    )
  }

  return (
    <div className="timeline-container" onClick={handleDeselect}>
      <div className="timeline-header">
        <span className="timeline-title">Timeline</span>
        <ZoomControls
          onZoomIn={() => zoom('in')}
          onZoomOut={() => zoom('out')}
        />
      </div>
      <TimeRuler
        scrollOffset={scrollOffset}
        visibleWidth={visibleWidth}
        onSeek={seekTo}
      />
      <ScrollContainer
        ref={scrollRef}
        totalWidth={totalWidth}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <Playhead scrollOffset={scrollOffset} />
        {timeline.tracks.map((track) => (
          <TrackLane
            key={track.id}
            track={track}
            syncPoints={timeline.syncPoints.filter(
              (sp) => sp.type === 'freeze' || sp.type === 'zoom'
                ? track.type === 'recording'
                : track.type === 'audio',
            )}
            zoomLevel={zoomLevel}
            scrollOffset={scrollOffset}
            onToggleMute={() => {
              // Toggle via store (will implement track update in store extension)
            }}
            onToggleLock={() => {
              // Toggle via store
            }}
          />
        ))}
      </ScrollContainer>
    </div>
  )
}
```

- [ ] **Step 2: Update PanelSystem to wire bottom panel and right panel**

Replace the bottom panel placeholder and properties panel placeholder in `src/renderer/components/layout/PanelSystem.tsx`:

```tsx
// Add imports at top:
import { useUIStore } from '../../stores/ui-store'
import { Timeline } from '../timeline/Timeline'
import { PropertiesPanel } from '../properties/PropertiesPanel'

// Note: ScriptOnlyView, DualPaneView, InlineEditorView will be added in later tasks.
// For now, wire the timeline into the InlineEditorView position.
```

Replace the bottom section:

```tsx
        {/* Bottom Section - Editor Views */}
        <div className="panel panel-timeline" style={{ height: timelineHeight }}>
          <div className="panel-content">
            <Timeline />
          </div>
        </div>
```

Replace the properties panel:

```tsx
          <div className="panel panel-properties">
            <div className="panel-header">Properties</div>
            <div className="panel-content">
              <PropertiesPanel />
            </div>
          </div>
```

Note: The full three-view switching will be wired in Task 14 after all views are created. For now, the Timeline renders directly.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: May have error for PropertiesPanel not existing yet — that's fine, we create it next.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/timeline/Timeline.tsx src/renderer/components/layout/PanelSystem.tsx
git commit -m "feat: add Timeline container and wire into PanelSystem"
```

---

## Task 11: Properties Panel

**Files:**
- Create: `src/renderer/components/properties/PropertiesPanel.tsx`
- Create: `src/renderer/components/properties/SyncPointProperties.tsx`
- Create: `src/renderer/components/properties/SegmentProperties.tsx`
- Modify: `src/renderer/styles/globals.css`

- [ ] **Step 1: Create SyncPointProperties**

```tsx
// src/renderer/components/properties/SyncPointProperties.tsx
import { useCallback } from 'react'
import type { SyncPoint, SyncPointType } from '@shared/types'
import { useTimelineStore } from '../../stores/timeline-store'
import { SYNC_POINT_COLORS } from '@shared/constants'

interface SyncPointPropertiesProps {
  syncPoint: SyncPoint
}

const SYNC_TYPES: SyncPointType[] = ['freeze', 'zoom', 'annotation', 'transition']

export function SyncPointProperties({ syncPoint }: SyncPointPropertiesProps): React.ReactNode {
  const updateSyncPoint = useTimelineStore((s) => s.updateSyncPoint)
  const removeSyncPoint = useTimelineStore((s) => s.removeSyncPoint)

  const handleUpdate = useCallback(
    (updates: Partial<SyncPoint>) => {
      updateSyncPoint(syncPoint.id, updates)
    },
    [syncPoint.id, updateSyncPoint],
  )

  return (
    <div className="properties-form">
      <div className="properties-section">
        <label className="properties-label">Type</label>
        <select
          className="properties-select"
          value={syncPoint.type}
          onChange={(e) => handleUpdate({ type: e.target.value as SyncPointType })}
        >
          {SYNC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <div
          className="properties-color-chip"
          style={{ backgroundColor: SYNC_POINT_COLORS[syncPoint.type] }}
        />
      </div>

      <div className="properties-section">
        <label className="properties-label">Timestamp (ms)</label>
        <input
          className="properties-input"
          type="number"
          value={syncPoint.timestamp}
          onChange={(e) => handleUpdate({ timestamp: Math.max(0, Number(e.target.value)) })}
          min={0}
          step={100}
        />
      </div>

      <div className="properties-section">
        <label className="properties-label">Duration (ms)</label>
        <input
          className="properties-input"
          type="number"
          value={syncPoint.duration}
          onChange={(e) => handleUpdate({ duration: Math.max(0, Number(e.target.value)) })}
          min={0}
          step={100}
        />
      </div>

      {syncPoint.annotationText !== undefined && (
        <div className="properties-section">
          <label className="properties-label">Annotation</label>
          <textarea
            className="properties-textarea"
            value={syncPoint.annotationText}
            onChange={(e) => handleUpdate({ annotationText: e.target.value })}
            rows={3}
          />
        </div>
      )}

      <div className="properties-section">
        <label className="properties-label">Confidence</label>
        <span className="properties-value">{(syncPoint.confidence * 100).toFixed(0)}%</span>
      </div>

      <div className="properties-section">
        <label className="properties-label">Source</label>
        <span className="properties-value">{syncPoint.source}</span>
      </div>

      <button className="properties-delete-btn" onClick={() => removeSyncPoint(syncPoint.id)}>
        Delete Sync Point
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create SegmentProperties**

```tsx
// src/renderer/components/properties/SegmentProperties.tsx
import type { Segment } from '@shared/types'

interface SegmentPropertiesProps {
  segment: Segment
}

export function SegmentProperties({ segment }: SegmentPropertiesProps): React.ReactNode {
  return (
    <div className="properties-form">
      <div className="properties-section">
        <label className="properties-label">Label</label>
        <span className="properties-value">{segment.label}</span>
      </div>

      <div className="properties-section">
        <label className="properties-label">Start Time (ms)</label>
        <span className="properties-value">{segment.startTime}</span>
      </div>

      <div className="properties-section">
        <label className="properties-label">End Time (ms)</label>
        <span className="properties-value">{segment.endTime}</span>
      </div>

      <div className="properties-section">
        <label className="properties-label">Duration</label>
        <span className="properties-value">{segment.endTime - segment.startTime}ms</span>
      </div>

      <div className="properties-section">
        <label className="properties-label">Source</label>
        <span className="properties-value">{segment.sourceFile || 'N/A'}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create PropertiesPanel**

```tsx
// src/renderer/components/properties/PropertiesPanel.tsx
import { useTimelineStore } from '../../stores/timeline-store'
import { SyncPointProperties } from './SyncPointProperties'
import { SegmentProperties } from './SegmentProperties'

export function PropertiesPanel(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)
  const selectedSyncPointId = useTimelineStore((s) => s.selectedSyncPointId)
  const selectedSegmentId = useTimelineStore((s) => s.selectedSegmentId)

  if (!timeline) {
    return <p className="panel-placeholder">No timeline loaded</p>
  }

  if (selectedSyncPointId) {
    const syncPoint = timeline.syncPoints.find((sp) => sp.id === selectedSyncPointId)
    if (syncPoint) {
      return <SyncPointProperties syncPoint={syncPoint} />
    }
  }

  if (selectedSegmentId) {
    const segment = timeline.tracks
      .flatMap((t) => t.segments)
      .find((s) => s.id === selectedSegmentId)
    if (segment) {
      return <SegmentProperties segment={segment} />
    }
  }

  return <p className="panel-placeholder">Select an item to edit</p>
}
```

- [ ] **Step 4: Add CSS for properties panel**

Add to `src/renderer/styles/globals.css`:

```css
/* Properties Panel */
.properties-form {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.properties-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.properties-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.properties-value {
  font-size: 12px;
  color: var(--text-primary);
}

.properties-input,
.properties-select,
.properties-textarea {
  padding: 5px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.properties-input:focus,
.properties-select:focus,
.properties-textarea:focus {
  border-color: var(--accent);
}

.properties-textarea {
  resize: vertical;
  font-family: inherit;
}

.properties-color-chip {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--border);
}

.properties-delete-btn {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--danger);
  border-radius: 4px;
  color: var(--danger);
  font-size: 12px;
  cursor: pointer;
  margin-top: 8px;
}

.properties-delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/properties/ src/renderer/styles/globals.css
git commit -m "feat: add PropertiesPanel with SyncPoint and Segment property forms"
```

---

## Task 12: Tiptap Script Editor (TiptapEditor, SectionBlock, TimingMarkerChip)

**Files:**
- Create: `src/renderer/components/script-editor/TiptapEditor.tsx`
- Create: `src/renderer/components/script-editor/SectionBlock.tsx`
- Create: `src/renderer/components/script-editor/TimingMarkerChip.tsx`
- Modify: `src/renderer/styles/globals.css`

- [ ] **Step 1: Create TimingMarkerChip**

```tsx
// src/renderer/components/script-editor/TimingMarkerChip.tsx
import type { TimingMarker } from '@shared/types'

interface TimingMarkerChipProps {
  marker: TimingMarker
}

const MARKER_COLORS: Record<string, string> = {
  pause: '#94a3b8',
  zoom: '#22c55e',
  freeze: '#3b82f6',
  transition: '#a855f7',
}

export function TimingMarkerChip({ marker }: TimingMarkerChipProps): React.ReactNode {
  const label = marker.type === 'pause'
    ? `PAUSE ${marker.duration ?? 0}s`
    : marker.type === 'zoom'
      ? `ZOOM ${marker.selector ?? ''}`
      : marker.type === 'freeze'
        ? `FREEZE ${marker.duration ?? 0}s`
        : `TRANSITION ${marker.transitionType ?? ''}`

  return (
    <span
      className="timing-marker-chip"
      style={{ borderColor: MARKER_COLORS[marker.type] }}
      title={label}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Create SectionBlock**

```tsx
// src/renderer/components/script-editor/SectionBlock.tsx
import type { ScriptSection } from '@shared/types'
import { TimingMarkerChip } from './TimingMarkerChip'

interface SectionBlockProps {
  section: ScriptSection
  isActive: boolean
  onTextChange: (text: string) => void
  onVoiceChange: (voiceId: string | null) => void
  onClick: () => void
}

export function SectionBlock({
  section,
  isActive,
  onTextChange,
  onVoiceChange,
  onClick,
}: SectionBlockProps): React.ReactNode {
  return (
    <div
      className={`section-block ${isActive ? 'active' : ''}`}
      onClick={onClick}
      data-section-id={section.id}
    >
      <div className="section-block-header">
        <span className="section-block-number">Section {section.order + 1}</span>
        <select
          className="section-voice-select"
          value={section.voiceProfileId ?? ''}
          onChange={(e) => onVoiceChange(e.target.value || null)}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Default Voice</option>
        </select>
      </div>

      {section.timingMarkers.length > 0 && (
        <div className="section-markers">
          {section.timingMarkers.map((marker, i) => (
            <TimingMarkerChip key={i} marker={marker} />
          ))}
        </div>
      )}

      <textarea
        className="section-block-text"
        value={section.text}
        onChange={(e) => onTextChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        rows={Math.max(2, Math.ceil(section.text.length / 80))}
      />

      <div className="section-block-footer">
        <span className="section-timing">
          {formatTime(section.startTime)} — {formatTime(section.endTime)}
        </span>
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}
```

- [ ] **Step 3: Create TiptapEditor**

```tsx
// src/renderer/components/script-editor/TiptapEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

interface TiptapEditorProps {
  content: string
  onUpdate: (html: string) => void
  editable?: boolean
}

export function TiptapEditor({ content, onUpdate, editable = true }: TiptapEditorProps): React.ReactNode {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content, editor])

  return (
    <div className="tiptap-editor-wrapper">
      <EditorContent editor={editor} className="tiptap-editor" />
    </div>
  )
}
```

- [ ] **Step 4: Add CSS for script editor components**

Add to `src/renderer/styles/globals.css`:

```css
/* Script Editor */
.script-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 8px;
  gap: 8px;
}

.section-block {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.section-block:hover {
  border-color: var(--text-muted);
}

.section-block.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.section-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-block-number {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.section-voice-select {
  padding: 3px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 11px;
}

.section-markers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.timing-marker-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid;
  border-radius: 3px;
  white-space: nowrap;
}

.section-block-text {
  width: 100%;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
  outline: none;
}

.section-block-text:focus {
  border-color: var(--accent);
}

.section-block-footer {
  margin-top: 6px;
}

.section-timing {
  font-size: 10px;
  color: var(--text-muted);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

/* Tiptap */
.tiptap-editor-wrapper {
  flex: 1;
  overflow: auto;
}

.tiptap-editor {
  padding: 12px;
  min-height: 100%;
  outline: none;
}

.tiptap-editor .ProseMirror {
  outline: none;
  min-height: 200px;
}

.tiptap-editor .ProseMirror p {
  margin-bottom: 0.75em;
  line-height: 1.6;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/script-editor/ src/renderer/styles/globals.css
git commit -m "feat: add script editor components (TiptapEditor, SectionBlock, TimingMarkerChip)"
```

---

## Task 13: Three Editor Views (ScriptOnlyView, DualPaneView, InlineEditorView)

**Files:**
- Create: `src/renderer/components/script-editor/ScriptOnlyView.tsx`
- Create: `src/renderer/components/script-editor/DualPaneView.tsx`
- Create: `src/renderer/components/script-editor/InlineEditorView.tsx`
- Create: `src/renderer/components/script-editor/ResizeDivider.tsx`
- Create: `src/renderer/components/timeline/InlineTextPopup.tsx`
- Create: `src/renderer/components/timeline/TimelineMinimap.tsx`
- Create: `src/renderer/hooks/useScrollSync.ts`
- Create: `src/renderer/hooks/useDualPaneSync.ts`

- [ ] **Step 1: Create ScriptOnlyView**

```tsx
// src/renderer/components/script-editor/ScriptOnlyView.tsx
import { useCallback } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { SectionBlock } from './SectionBlock'
import type { ScriptSection } from '@shared/types'

interface ScriptOnlyViewProps {
  sections: ScriptSection[]
  onUpdateSection: (id: string, updates: Partial<ScriptSection>) => void
}

export function ScriptOnlyView({ sections, onUpdateSection }: ScriptOnlyViewProps): React.ReactNode {
  const selectedSectionId = useTimelineStore((s) => s.selectedSyncPointId)
  const setSelectedSection = useTimelineStore((s) => s.setSelectedSyncPoint)

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      onUpdateSection(id, { text })
    },
    [onUpdateSection],
  )

  const handleVoiceChange = useCallback(
    (id: string, voiceProfileId: string | null) => {
      onUpdateSection(id, { voiceProfileId })
    },
    [onUpdateSection],
  )

  return (
    <div className="script-editor-container">
      {sections
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            isActive={selectedSectionId === section.id}
            onTextChange={(text) => handleTextChange(section.id, text)}
            onVoiceChange={(voice) => handleVoiceChange(section.id, voice)}
            onClick={() => setSelectedSection(section.id)}
          />
        ))}
    </div>
  )
}
```

- [ ] **Step 2: Create ResizeDivider**

```tsx
// src/renderer/components/script-editor/ResizeDivider.tsx
import { useCallback, useRef } from 'react'

interface ResizeDividerProps {
  onResize: (delta: number) => void
}

export function ResizeDivider({ onResize }: ResizeDividerProps): React.ReactNode {
  const startX = useRef(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      startX.current = e.clientX

      const handleMove = (e: PointerEvent) => {
        const delta = e.clientX - startX.current
        startX.current = e.clientX
        onResize(delta)
      }

      const handleUp = () => {
        target.removeEventListener('pointermove', handleMove)
        target.removeEventListener('pointerup', handleUp)
      }

      target.addEventListener('pointermove', handleMove)
      target.addEventListener('pointerup', handleUp)
    },
    [onResize],
  )

  return <div className="resize-divider-v" onPointerDown={handlePointerDown} />
}
```

- [ ] **Step 3: Create useScrollSync and useDualPaneSync**

```typescript
// src/renderer/hooks/useScrollSync.ts
import { useCallback, useRef } from 'react'

export function useScrollSync(
  sourceRef: React.RefObject<HTMLElement | null>,
  targetRef: React.RefObject<HTMLElement | null>,
) {
  const isScrolling = useRef(false)

  const syncScroll = useCallback(() => {
    if (isScrolling.current) return
    if (!sourceRef.current || !targetRef.current) return

    isScrolling.current = true
    const sourceMax = sourceRef.current.scrollHeight - sourceRef.current.clientHeight
    const targetMax = targetRef.current.scrollHeight - targetRef.current.clientHeight
    if (sourceMax > 0 && targetMax > 0) {
      const ratio = sourceRef.current.scrollTop / sourceMax
      targetRef.current.scrollTop = ratio * targetMax
    }
    requestAnimationFrame(() => { isScrolling.current = false })
  }, [sourceRef, targetRef])

  return { syncScroll }
}
```

```typescript
// src/renderer/hooks/useDualPaneSync.ts
import { useCallback } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import type { ScriptSection } from '@shared/types'

export function useDualPaneSync(sections: ScriptSection[]) {
  const setSelectedSyncPoint = useTimelineStore((s) => s.setSelectedSyncPoint)

  const selectSection = useCallback(
    (sectionId: string) => {
      setSelectedSyncPoint(sectionId)
    },
    [setSelectedSyncPoint],
  )

  const getSectionAtTime = useCallback(
    (timeMs: number): ScriptSection | undefined => {
      return sections.find((s) => s.startTime <= timeMs && s.endTime >= timeMs)
    },
    [sections],
  )

  return { selectSection, getSectionAtTime }
}
```

- [ ] **Step 4: Create TimelineMinimap**

```tsx
// src/renderer/components/timeline/TimelineMinimap.tsx
import { useTimelineStore } from '../../stores/timeline-store'
import { SYNC_POINT_COLORS } from '@shared/constants'

export function TimelineMinimap(): React.ReactNode {
  const timeline = useTimelineStore((s) => s.timeline)

  if (!timeline || timeline.duration === 0) {
    return <div className="timeline-minimap">No timeline</div>
  }

  const duration = timeline.duration

  return (
    <div className="timeline-minimap">
      {timeline.tracks.map((track) => (
        <div key={track.id} className="minimap-track">
          <span className="minimap-track-label">{track.label}</span>
          <div className="minimap-track-bar">
            {track.segments.map((seg) => (
              <div
                key={seg.id}
                className="minimap-segment"
                style={{
                  left: `${(seg.startTime / duration) * 100}%`,
                  width: `${((seg.endTime - seg.startTime) / duration) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="minimap-sync-points">
        {timeline.syncPoints.map((sp) => (
          <div
            key={sp.id}
            className="minimap-sync-marker"
            style={{
              left: `${(sp.timestamp / duration) * 100}%`,
              backgroundColor: SYNC_POINT_COLORS[sp.type],
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create InlineTextPopup**

```tsx
// src/renderer/components/timeline/InlineTextPopup.tsx
import { useState, useCallback } from 'react'

interface InlineTextPopupProps {
  text: string
  voiceProfileId: string | null
  position: { x: number; y: number }
  onSave: (text: string, voiceProfileId: string | null) => void
  onClose: () => void
}

export function InlineTextPopup({
  text: initialText,
  voiceProfileId: initialVoice,
  position,
  onSave,
  onClose,
}: InlineTextPopupProps): React.ReactNode {
  const [text, setText] = useState(initialText)
  const [voice, setVoice] = useState(initialVoice)

  const handleSave = useCallback(() => {
    onSave(text, voice)
    onClose()
  }, [text, voice, onSave, onClose])

  return (
    <div
      className="inline-text-popup"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        className="inline-text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        autoFocus
      />
      <div className="inline-text-controls">
        <select
          className="section-voice-select"
          value={voice ?? ''}
          onChange={(e) => setVoice(e.target.value || null)}
        >
          <option value="">Default Voice</option>
        </select>
        <div className="inline-text-buttons">
          <button className="toolbar-btn" onClick={onClose}>Cancel</button>
          <button className="wizard-btn wizard-btn-create" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create DualPaneView**

```tsx
// src/renderer/components/script-editor/DualPaneView.tsx
import { useState, useRef, useCallback } from 'react'
import { ScriptOnlyView } from './ScriptOnlyView'
import { TimelineMinimap } from '../timeline/TimelineMinimap'
import { ResizeDivider } from './ResizeDivider'
import { useScrollSync } from '../../hooks/useScrollSync'
import type { ScriptSection } from '@shared/types'

interface DualPaneViewProps {
  sections: ScriptSection[]
  onUpdateSection: (id: string, updates: Partial<ScriptSection>) => void
}

export function DualPaneView({ sections, onUpdateSection }: DualPaneViewProps): React.ReactNode {
  const [leftWidth, setLeftWidth] = useState(50) // percentage
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const { syncScroll } = useScrollSync(leftRef, rightRef)

  const handleResize = useCallback((delta: number) => {
    setLeftWidth((prev) => Math.max(20, Math.min(80, prev + (delta / window.innerWidth) * 100)))
  }, [])

  return (
    <div className="dual-pane-view">
      <div className="dual-pane-left" ref={leftRef} style={{ width: `${leftWidth}%` }} onScroll={syncScroll}>
        <ScriptOnlyView sections={sections} onUpdateSection={onUpdateSection} />
      </div>
      <ResizeDivider onResize={handleResize} />
      <div className="dual-pane-right" ref={rightRef} style={{ width: `${100 - leftWidth}%` }}>
        <TimelineMinimap />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create InlineEditorView**

```tsx
// src/renderer/components/script-editor/InlineEditorView.tsx
import { Timeline } from '../timeline/Timeline'

export function InlineEditorView(): React.ReactNode {
  return (
    <div className="inline-editor-view">
      <Timeline />
    </div>
  )
}
```

- [ ] **Step 8: Add CSS for dual-pane, minimap, inline popup**

Add to `src/renderer/styles/globals.css`:

```css
/* Dual Pane View */
.dual-pane-view {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.dual-pane-left,
.dual-pane-right {
  overflow-y: auto;
  overflow-x: hidden;
}

.resize-divider-v {
  width: 4px;
  flex-shrink: 0;
  background: var(--border);
  cursor: col-resize;
  transition: background 0.15s;
}

.resize-divider-v:hover {
  background: var(--accent);
}

.inline-editor-view {
  height: 100%;
}

/* Timeline Minimap */
.timeline-minimap {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.minimap-track {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 16px;
}

.minimap-track-label {
  font-size: 9px;
  color: var(--text-muted);
  width: 50px;
  flex-shrink: 0;
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
}

.minimap-track-bar {
  flex: 1;
  height: 8px;
  position: relative;
  background: var(--bg-secondary);
  border-radius: 2px;
}

.minimap-segment {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--bg-hover);
  border-radius: 1px;
}

.minimap-sync-points {
  position: relative;
  height: 12px;
  margin-top: 4px;
}

.minimap-sync-marker {
  position: absolute;
  top: 0;
  width: 4px;
  height: 100%;
  border-radius: 1px;
  opacity: 0.8;
}

/* Inline Text Popup */
.inline-text-popup {
  position: absolute;
  z-index: 100;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  width: 300px;
}

.inline-text-input {
  width: 100%;
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
  outline: none;
}

.inline-text-input:focus {
  border-color: var(--accent);
}

.inline-text-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.inline-text-buttons {
  display: flex;
  gap: 6px;
}
```

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 10: Commit**

```bash
git add src/renderer/components/script-editor/ src/renderer/components/timeline/InlineTextPopup.tsx src/renderer/components/timeline/TimelineMinimap.tsx src/renderer/hooks/useScrollSync.ts src/renderer/hooks/useDualPaneSync.ts src/renderer/styles/globals.css
git commit -m "feat: add three editor views (ScriptOnly, DualPane, Inline) with sync hooks"
```

---

## Task 14: Wire Editor Views into PanelSystem

**Files:**
- Modify: `src/renderer/components/layout/PanelSystem.tsx`

- [ ] **Step 1: Update PanelSystem to switch between editor views**

Update `src/renderer/components/layout/PanelSystem.tsx` to import and render the three views based on `editorView` from `ui-store`:

```tsx
// Add imports:
import { useUIStore, type EditorView } from '../../stores/ui-store'
import { Timeline } from '../timeline/Timeline'
import { PropertiesPanel } from '../properties/PropertiesPanel'
import { ScriptOnlyView } from '../script-editor/ScriptOnlyView'
import { DualPaneView } from '../script-editor/DualPaneView'
import { InlineEditorView } from '../script-editor/InlineEditorView'

// Inside PanelSystem, add:
  const editorView = useUIStore((s) => s.editorView)

// Replace the bottom panel content:
        <div className="panel panel-timeline" style={{ height: timelineHeight }}>
          <div className="panel-content">
            {editorView === 'script-only' && (
              <ScriptOnlyView sections={[]} onUpdateSection={() => {}} />
            )}
            {editorView === 'dual-pane' && (
              <DualPaneView sections={[]} onUpdateSection={() => {}} />
            )}
            {editorView === 'inline' && (
              <InlineEditorView />
            )}
          </div>
        </div>
```

Note: The `sections` and `onUpdateSection` props will be connected to real data when the project store is extended with script section management. For now they receive empty arrays / noops to compile.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/layout/PanelSystem.tsx
git commit -m "feat: wire three editor views into PanelSystem bottom panel"
```

---

## Task 15: Integration Tests — View Mode Switching

**Files:**
- Create: `tests/integration/view-mode-switching.test.tsx`

- [ ] **Step 1: Write view mode switching tests**

```tsx
// tests/integration/view-mode-switching.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { ViewModeToggle } from '@renderer/components/layout/ViewModeToggle'

describe('ViewModeToggle (integration)', () => {
  beforeEach(() => {
    useUIStore.setState({ editorView: 'dual-pane' })
  })

  it('renders three view buttons', () => {
    render(<ViewModeToggle />)
    expect(screen.getByText('Script')).toBeDefined()
    expect(screen.getByText('Split')).toBeDefined()
    expect(screen.getByText('Timeline')).toBeDefined()
  })

  it('highlights the active view', () => {
    render(<ViewModeToggle />)
    const splitBtn = screen.getByText('Split')
    expect(splitBtn.classList.contains('active')).toBe(true)
  })

  it('switches view on click and updates store', () => {
    render(<ViewModeToggle />)
    fireEvent.click(screen.getByText('Script'))
    expect(useUIStore.getState().editorView).toBe('script-only')

    fireEvent.click(screen.getByText('Timeline'))
    expect(useUIStore.getState().editorView).toBe('inline')
  })

  it('persists view state across re-renders', () => {
    const { rerender } = render(<ViewModeToggle />)
    fireEvent.click(screen.getByText('Script'))
    rerender(<ViewModeToggle />)
    const scriptBtn = screen.getByText('Script')
    expect(scriptBtn.classList.contains('active')).toBe(true)
  })

  it('supports keyboard shortcut Cmd+1/2/3', () => {
    render(<ViewModeToggle />)

    fireEvent.keyDown(window, { key: '1', metaKey: true })
    expect(useUIStore.getState().editorView).toBe('script-only')

    fireEvent.keyDown(window, { key: '2', metaKey: true })
    expect(useUIStore.getState().editorView).toBe('dual-pane')

    fireEvent.keyDown(window, { key: '3', metaKey: true })
    expect(useUIStore.getState().editorView).toBe('inline')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/integration/view-mode-switching.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/view-mode-switching.test.tsx
git commit -m "test: add integration tests for view mode switching"
```

---

## Task 16: Integration Tests — Timeline Editor

**Files:**
- Create: `tests/integration/timeline-editor.test.tsx`

- [ ] **Step 1: Write timeline editor integration tests**

```tsx
// tests/integration/timeline-editor.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useTimelineStore } from '@renderer/stores/timeline-store'
import { PropertiesPanel } from '@renderer/components/properties/PropertiesPanel'
import type { SyncTimeline, SyncPoint, Track, Segment } from '@shared/types'

function makeSyncPoint(overrides: Partial<SyncPoint> = {}): SyncPoint {
  return {
    id: 'sp-1',
    timelineId: 'tl-1',
    timestamp: 2000,
    type: 'freeze',
    source: 'dom',
    duration: 1000,
    confidence: 0.8,
    ...overrides,
  }
}

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    id: 'seg-1',
    trackId: 'track-1',
    startTime: 0,
    endTime: 5000,
    sourceFile: '/tmp/video.mp4',
    sourceOffset: 0,
    label: 'Recording',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    type: 'recording',
    segments: [makeSegment()],
    zOrder: 0,
    label: 'Recording',
    muted: false,
    locked: false,
    ...overrides,
  }
}

function makeTimeline(overrides: Partial<SyncTimeline> = {}): SyncTimeline {
  return {
    id: 'tl-1',
    projectId: 'p-1',
    tracks: [makeTrack()],
    syncPoints: [makeSyncPoint()],
    duration: 30000,
    reviewed: false,
    ...overrides,
  }
}

describe('Timeline Editor (integration)', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      timeline: makeTimeline(),
      playheadPosition: 0,
      zoomLevel: 1,
      selectedSyncPointId: null,
      selectedSegmentId: null,
      isPlaying: false,
    })
  })

  describe('sync point CRUD via store', () => {
    it('adds a sync point to the timeline', () => {
      const newPoint = makeSyncPoint({ id: 'sp-2', timestamp: 5000, type: 'zoom' })
      useTimelineStore.getState().addSyncPoint(newPoint)

      const timeline = useTimelineStore.getState().timeline!
      expect(timeline.syncPoints).toHaveLength(2)
      expect(timeline.syncPoints[1].type).toBe('zoom')
    })

    it('updates sync point properties', () => {
      useTimelineStore.getState().updateSyncPoint('sp-1', { timestamp: 3000, type: 'annotation' })

      const sp = useTimelineStore.getState().timeline!.syncPoints[0]
      expect(sp.timestamp).toBe(3000)
      expect(sp.type).toBe('annotation')
    })

    it('removes a sync point', () => {
      useTimelineStore.getState().removeSyncPoint('sp-1')

      const timeline = useTimelineStore.getState().timeline!
      expect(timeline.syncPoints).toHaveLength(0)
    })
  })

  describe('undo/redo', () => {
    it('undoes sync point addition', () => {
      const newPoint = makeSyncPoint({ id: 'sp-2', timestamp: 5000 })
      useTimelineStore.getState().addSyncPoint(newPoint)
      expect(useTimelineStore.getState().timeline!.syncPoints).toHaveLength(2)

      useTimelineStore.temporal.getState().undo()
      expect(useTimelineStore.getState().timeline!.syncPoints).toHaveLength(1)
    })

    it('redoes sync point addition', () => {
      const newPoint = makeSyncPoint({ id: 'sp-2', timestamp: 5000 })
      useTimelineStore.getState().addSyncPoint(newPoint)
      useTimelineStore.temporal.getState().undo()
      useTimelineStore.temporal.getState().redo()

      expect(useTimelineStore.getState().timeline!.syncPoints).toHaveLength(2)
    })

    it('undoes sync point update', () => {
      useTimelineStore.getState().updateSyncPoint('sp-1', { timestamp: 9999 })
      useTimelineStore.temporal.getState().undo()

      expect(useTimelineStore.getState().timeline!.syncPoints[0].timestamp).toBe(2000)
    })
  })

  describe('PropertiesPanel integration', () => {
    it('shows placeholder when nothing is selected', () => {
      render(<PropertiesPanel />)
      expect(screen.getByText('Select an item to edit')).toBeDefined()
    })

    it('shows sync point properties when a sync point is selected', () => {
      useTimelineStore.setState({ selectedSyncPointId: 'sp-1' })
      render(<PropertiesPanel />)
      expect(screen.getByDisplayValue('2000')).toBeDefined() // timestamp input
    })

    it('shows segment properties when a segment is selected', () => {
      useTimelineStore.setState({ selectedSegmentId: 'seg-1' })
      render(<PropertiesPanel />)
      expect(screen.getByText('Recording')).toBeDefined() // label
    })
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/integration/timeline-editor.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/timeline-editor.test.tsx
git commit -m "test: add timeline editor integration tests (CRUD, undo/redo, properties panel)"
```

---

## Task 17: Integration Tests — Script Editor

**Files:**
- Create: `tests/integration/script-editor.test.tsx`

- [ ] **Step 1: Write script editor integration tests**

```tsx
// tests/integration/script-editor.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionBlock } from '@renderer/components/script-editor/SectionBlock'
import { TimingMarkerChip } from '@renderer/components/script-editor/TimingMarkerChip'
import type { ScriptSection, TimingMarker } from '@shared/types'

function makeSection(overrides: Partial<ScriptSection> = {}): ScriptSection {
  return {
    id: 'sec-1',
    scriptId: 'script-1',
    text: 'Welcome to this tutorial',
    voiceProfileId: null,
    startTime: 0,
    endTime: 5000,
    timingMarkers: [],
    order: 0,
    ...overrides,
  }
}

describe('SectionBlock (integration)', () => {
  it('renders section text and order', () => {
    render(
      <SectionBlock
        section={makeSection()}
        isActive={false}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('Section 1')).toBeDefined()
    expect(screen.getByDisplayValue('Welcome to this tutorial')).toBeDefined()
  })

  it('calls onTextChange when text is edited', () => {
    const onTextChange = vi.fn()
    render(
      <SectionBlock
        section={makeSection()}
        isActive={false}
        onTextChange={onTextChange}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    const textarea = screen.getByDisplayValue('Welcome to this tutorial')
    fireEvent.change(textarea, { target: { value: 'Updated text' } })
    expect(onTextChange).toHaveBeenCalledWith('Updated text')
  })

  it('calls onClick when section block is clicked', () => {
    const onClick = vi.fn()
    render(
      <SectionBlock
        section={makeSection()}
        isActive={false}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={onClick}
      />,
    )
    fireEvent.click(screen.getByText('Section 1'))
    expect(onClick).toHaveBeenCalled()
  })

  it('shows active styling when isActive is true', () => {
    const { container } = render(
      <SectionBlock
        section={makeSection()}
        isActive={true}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    const block = container.querySelector('.section-block')
    expect(block?.classList.contains('active')).toBe(true)
  })

  it('renders timing markers when present', () => {
    const markers: TimingMarker[] = [
      { type: 'pause', position: 100, duration: 1.5 },
      { type: 'zoom', position: 200, selector: '.btn' },
    ]
    render(
      <SectionBlock
        section={makeSection({ timingMarkers: markers })}
        isActive={false}
        onTextChange={() => {}}
        onVoiceChange={() => {}}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('PAUSE 1.5s')).toBeDefined()
    expect(screen.getByText('ZOOM .btn')).toBeDefined()
  })
})

describe('TimingMarkerChip', () => {
  it('renders pause marker', () => {
    render(<TimingMarkerChip marker={{ type: 'pause', position: 0, duration: 2 }} />)
    expect(screen.getByText('PAUSE 2s')).toBeDefined()
  })

  it('renders freeze marker', () => {
    render(<TimingMarkerChip marker={{ type: 'freeze', position: 0, duration: 3 }} />)
    expect(screen.getByText('FREEZE 3s')).toBeDefined()
  })

  it('renders zoom marker with selector', () => {
    render(<TimingMarkerChip marker={{ type: 'zoom', position: 0, selector: '#submit' }} />)
    expect(screen.getByText('ZOOM #submit')).toBeDefined()
  })

  it('renders transition marker', () => {
    render(<TimingMarkerChip marker={{ type: 'transition', position: 0, transitionType: 'fade' }} />)
    expect(screen.getByText('TRANSITION fade')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/integration/script-editor.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/script-editor.test.tsx
git commit -m "test: add script editor integration tests (SectionBlock, TimingMarkerChip)"
```

---

## Task 18: Keyboard Shortcuts (Space, Delete, Cmd+D, Arrows, Home/End)

**Files:**
- Modify: `src/renderer/hooks/useUndoRedo.ts`

- [ ] **Step 1: Extend useUndoRedo to handle all keyboard shortcuts**

Update `src/renderer/hooks/useUndoRedo.ts` to add Space (play/pause), Delete, Cmd+D, arrow nudge, Home/End, and +/- zoom:

```typescript
// src/renderer/hooks/useUndoRedo.ts
import { useEffect } from 'react'
import { useProjectStore } from '../stores/project-store'
import { useTimelineStore } from '../stores/timeline-store'
import { useUIStore, type EditorView } from '../stores/ui-store'

const VIEW_KEYS: EditorView[] = ['script-only', 'dual-pane', 'inline']

export function useUndoRedo(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Undo/Redo
      if (isMod && e.key === 'z') {
        e.preventDefault()
        const projectTemporal = useProjectStore.temporal.getState()
        const timelineTemporal = useTimelineStore.temporal.getState()
        if (e.shiftKey) {
          projectTemporal.redo()
          timelineTemporal.redo()
        } else {
          projectTemporal.undo()
          timelineTemporal.undo()
        }
        return
      }

      // View switching: Cmd+1/2/3 (handled by ViewModeToggle, but kept for completeness)

      // Space: play/pause (only when not in a text input)
      if (e.key === ' ' && !isInput) {
        e.preventDefault()
        const store = useTimelineStore.getState()
        store.setIsPlaying(!store.isPlaying)
        return
      }

      // Delete/Backspace: remove selected sync point or segment
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        e.preventDefault()
        const store = useTimelineStore.getState()
        if (store.selectedSyncPointId) {
          store.removeSyncPoint(store.selectedSyncPointId)
          store.setSelectedSyncPoint(null)
        }
        return
      }

      // +/-: zoom
      if ((e.key === '+' || e.key === '=') && !isInput) {
        useTimelineStore.getState().setZoomLevel(
          Math.min(10, useTimelineStore.getState().zoomLevel * 1.2),
        )
        return
      }
      if (e.key === '-' && !isInput) {
        useTimelineStore.getState().setZoomLevel(
          Math.max(0.1, useTimelineStore.getState().zoomLevel / 1.2),
        )
        return
      }

      // Home/End: jump playhead
      if (e.key === 'Home' && !isInput) {
        useTimelineStore.getState().setPlayheadPosition(0)
        return
      }
      if (e.key === 'End' && !isInput) {
        const duration = useTimelineStore.getState().timeline?.duration ?? 0
        useTimelineStore.getState().setPlayheadPosition(duration)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project tsconfig.json 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useUndoRedo.ts
git commit -m "feat: extend keyboard shortcuts (Space, Delete, +/-, Home/End)"
```

---

## Task 19: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing 155 + new unit and integration tests).

- [ ] **Step 2: Verify TypeScript strict compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Verify build**

Run: `npx electron-vite build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit any remaining changes**

```bash
git status
# If any uncommitted changes, stage and commit
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Dependencies & config | Verify existing pass |
| 2 | timeline-utils (pure functions) | 20+ unit tests |
| 3 | PlayheadEmitter | 4 unit tests |
| 4 | usePointerDrag hook | TypeScript compile |
| 5 | usePlayhead hook | TypeScript compile |
| 6 | useTimelineZoom hook | 4 unit tests |
| 7 | ViewModeToggle + Toolbar | TypeScript compile |
| 8 | TimeRuler, Playhead, ScrollContainer, ZoomControls | TypeScript compile |
| 9 | TrackHeader, TrackLane, Segment, SyncPointMarker | TypeScript compile |
| 10 | Timeline container + PanelSystem wiring | TypeScript compile |
| 11 | PropertiesPanel | TypeScript compile |
| 12 | TiptapEditor, SectionBlock, TimingMarkerChip | TypeScript compile |
| 13 | Three editor views + sync hooks | TypeScript compile |
| 14 | Wire views into PanelSystem | TypeScript compile |
| 15 | Integration: view mode switching | 5 tests |
| 16 | Integration: timeline editor | 9 tests |
| 17 | Integration: script editor | 9 tests |
| 18 | Keyboard shortcuts | TypeScript compile |
| 19 | Final verification | All tests, build |
