# Deep Interview Spec: Compose & Script View Overhaul

## Metadata
- Interview ID: compose-script-overhaul-2026-04-11
- Rounds: 10
- Final Ambiguity Score: 9%
- Type: brownfield
- Generated: 2026-04-11
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.35 | 0.333 |
| Constraint Clarity | 0.85 | 0.25 | 0.213 |
| Success Criteria | 0.90 | 0.25 | 0.225 |
| Context Clarity | 0.92 | 0.15 | 0.138 |
| **Total Clarity** | | | **0.908** |
| **Ambiguity** | | | **9%** |

## Goal
Restructure the Leonardo edit page from 3 workspace presets (recording → editing → export) to 4 presets (recording → compose → script → export). The **compose** view replaces editing with a storyboard + timeline dual representation for defining video structure (transitions, intros, exits). The **script** view is a new dedicated preset for editing/refining AI-generated narration scripts. Remove the old DualPaneView split. Add configurable AI backend selection (claude/codex/ollama), real-time streaming operation logs, auto freeze-frame insertion, draggable event-to-section assignment, and detailed error logging for AI failures.

## Constraints
- **AI Backends**: Claude CLI, Codex CLI (OpenAI), Ollama HTTP API — all behind unified IAIProvider interface
- **Backend Selection**: Global default in project settings + optional per-step override dropdown
- **Operation Log**: Real-time streaming (not post-generation summary), collapsible, persists after completion
- **Freeze Frame Calculation**: WPM-based (default ~150 WPM), user-overridable per-section
- **Error Handling**: On AI invocation failure, show detailed error log with copy-paste button for external debugging
- **Scope**: Edit page only — recording and export presets are unaffected
- **Existing Architecture**: Build on existing Zustand stores, Electron IPC, SQLite persistence, React component hierarchy
- **CLI Invocation**: Use existing cli-runner.ts pattern for CLI-based providers (claude, codex)

## Non-Goals
- Changing the recording workflow or capture pipeline
- Modifying the export preset
- Adding new AI providers beyond claude/codex/ollama
- SDK/npm-package-based AI provider integration (CLI and HTTP only)
- Per-step persistent backend memory (per-generation choice, not persisted on the step)

## Acceptance Criteria
- [ ] 1. Toolbar shows 4 presets: Recording → Compose → Script → Export
- [ ] 2. Compose view: storyboard panel (reorderable step cards with intro/outro types) synced bidirectionally with a timeline
- [ ] 3. Step cards show: clip segment, DOM event chips, transition selector, script narration placeholder
- [ ] 4. Script view layout: script editor (left) + video preview (right) + timeline (bottom)
- [ ] 5. DualPaneView (split timeline/script) is removed
- [ ] 6. DOM events are draggable chips assignable to script sections (1-N events per section)
- [ ] 7. Per-step scripts contain [ACTION: ...] markers referencing DOM events
- [ ] 8. AI backend selector: global default (claude/codex/ollama) + optional per-step override dropdown
- [ ] 9. Unified IAIProvider interface abstracts CLI-based (claude, codex) and HTTP-based (ollama) providers
- [ ] 10. Real-time streaming operation log during script generation (collapsible, persists after completion)
- [ ] 11. Auto freeze-frame: WPM-based calculation inserts freeze frames when narration exceeds event gap, user can override duration per-section
- [ ] 12. On AI invocation error: detailed error log with copy-paste button for external debugging
- [ ] 13. All existing tests continue to pass

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Script editing can happen inline in compose | Contrarian: Why a separate preset when step cards already have script placeholders? | User confirmed: compose = STRUCTURE, script = CONTENT. Different mental modes need different UI layouts. Script shows scripts prominently with minimal timeline. |
| Per-step backend selection is needed | Simplifier: Global setting vs per-step adds significant complexity | User chose: global default + optional per-step override. "We doubt this complexity is needed, but nice to have." |
| 4 presets vs 3 with sub-views | Contrarian: Separate preset means duplicating context | User confirmed: "Script preset IS needed — different focus" |
| Script sections map 1:1 to events | Clarification: How to handle multi-event narration | User chose: draggable event chips into sections, 1-N events per section |
| Post-generation summary for operation log | Clarification: Real-time vs post-hoc | User chose: real-time streaming log during generation |

## Technical Context

### Current Architecture (Brownfield)
- **Workspace presets**: `WorkspacePreset = 'recording' | 'editing' | 'export'` in `src/renderer/stores/ui-store.ts`
- **Editor views**: `EditorView = 'script-only' | 'dual-pane' | 'inline'` — DualPaneView to be removed
- **PanelSystem**: `src/renderer/components/layout/PanelSystem.tsx` — main layout orchestrator with collapsible panels
- **Toolbar**: `src/renderer/components/layout/Toolbar.tsx` — preset tabs
- **AI Providers**: `src/main/services/ai/` — IAIProvider interface, claude-provider.ts, ollama-provider.ts, openai-provider.ts
- **CLI Runner**: `src/main/services/ai/cli-runner.ts` — executes Claude CLI, extend for Codex CLI
- **Script Store**: `src/renderer/stores/script-store.ts` — clipScripts map, sections state
- **Timeline Store**: `src/renderer/stores/timeline-store.ts` — SyncTimeline, tracks, segments, sync points (including freeze type)
- **DOM Events**: `src/shared/types/events.ts` — DOMEvent with type, selector, coordinates, elementText, ariaLabel, tagName, etc.
- **Script Parser**: `src/main/services/ai/script-parser.ts` — parses [PAUSE], [ZOOM], [FREEZE], [TRANSITION] markers
- **Prompt Templates**: `src/main/services/ai/prompt-templates.ts` — builds prompts from DOM events + user input
- **IPC Channels**: `src/shared/constants.ts` — ai:generate-script, script:save, script:list-by-project
- **Preload Bridge**: `src/preload/index.ts` — window.leonardo.ai, window.leonardo.script

### Key Types to Extend
```typescript
// Extend WorkspacePreset
type WorkspacePreset = 'recording' | 'compose' | 'script' | 'export'

// New: StoryboardStep (compose view)
interface StoryboardStep {
  id: string
  type: 'intro' | 'step' | 'outro'
  segmentId: string | null        // linked timeline segment
  eventIds: string[]              // assigned DOM event IDs
  transitionType: TransitionType  // transition to next step
  scriptPlaceholder: string       // narration preview text
  order: number
}

// Extend ScriptSection for multi-event + action markers
interface ScriptSection {
  // ... existing fields ...
  eventIds: string[]              // NEW: 1-N assigned DOM event IDs
  actionMarkers: ActionMarker[]   // NEW: parsed [ACTION: ...] references
  estimatedDurationMs: number     // NEW: WPM-based narration estimate
  freezeOverrideMs: number | null // NEW: user override for auto-freeze
}

// New: ActionMarker
interface ActionMarker {
  eventId: string
  position: number  // char offset in script text
  label: string     // display text e.g. "click Save"
}

// New: GenerationLog entry
interface GenerationLogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error'
  message: string
  data?: unknown  // raw response, error details, etc.
}

// Extend AIBackendConfig
interface AIBackendConfig {
  provider: 'claude' | 'codex' | 'ollama'
  // ... existing fields ...
}
```

### Files to Create
- `src/renderer/components/compose/StoryboardPanel.tsx` — storyboard card view
- `src/renderer/components/compose/StepCard.tsx` — individual step card
- `src/renderer/components/compose/ComposeView.tsx` — compose preset layout
- `src/renderer/components/script-view/ScriptPresetView.tsx` — script preset layout
- `src/renderer/components/script-view/OperationLog.tsx` — streaming log panel
- `src/renderer/components/script-view/ErrorLog.tsx` — detailed error log with copy button
- `src/renderer/stores/compose-store.ts` — storyboard state
- `src/main/services/ai/codex-provider.ts` — Codex CLI provider

### Files to Modify
- `src/shared/types/` — extend WorkspacePreset, ScriptSection, add StoryboardStep, ActionMarker, GenerationLogEntry
- `src/renderer/stores/ui-store.ts` — add 'compose' | 'script' presets
- `src/renderer/stores/script-store.ts` — add eventIds, actionMarkers, freeze override
- `src/renderer/components/layout/Toolbar.tsx` — 4 preset tabs
- `src/renderer/components/layout/PanelSystem.tsx` — compose and script preset layouts
- `src/renderer/components/layout/Workspace.tsx` — preset routing
- `src/main/services/ai/index.ts` — add codex provider, streaming support
- `src/main/services/ai/prompt-templates.ts` — action marker generation
- `src/main/services/ai/script-parser.ts` — parse [ACTION: ...] markers
- `src/main/ipc/ai.ipc.ts` — streaming log events, error detail capture
- `src/preload/index.ts` — expose streaming log channel
- `src/shared/constants.ts` — new IPC channels for streaming, compose data

### Files to Remove
- `src/renderer/components/script-editor/DualPaneView.tsx` — replaced by new script preset view

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Compose View | core domain | storyboard panel, timeline, bidirectional sync | replaces editing preset, contains StoryboardSteps |
| Script View | core domain | script editor, video preview, timeline | new preset between compose and export |
| Storyboard | core domain | steps[], order | syncs bidirectionally with timeline |
| Step Card | core domain | type (intro/step/outro), segmentId, eventIds, transition, scriptPlaceholder | belongs to Storyboard, maps to Segment |
| Action Marker | core domain | eventId, position, label | inline in script text, references DOMEvent |
| Multi-Event Section | core domain | eventIds[], script text | ScriptSection extended with 1-N events |
| Auto Freeze Frame | core domain | wpmRate, estimatedDuration, freezeOverride | inserted when narration > event gap |
| Script Generator | supporting | prompt, context, backend | produces Script via IAIProvider |
| AI Provider Interface | external system | CLI (claude, codex), HTTP (ollama) | unified abstraction for generation |
| Operation Log | supporting | entries[], streaming, collapsible | shown during/after generation |
| Error Log | supporting | detailed error, copy button | shown on AI invocation failure |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 5 | 5 | - | - | - |
| 2 | 6 | 1 | 0 | 5 | 83% |
| 3 | 7 | 1 | 0 | 6 | 86% |
| 4 | 7 | 0 | 1 | 6 | 100% |
| 5 | 7 | 0 | 0 | 7 | 100% |
| 6 | 8 | 1 | 0 | 7 | 88% |
| 7 | 10 | 2 | 0 | 8 | 80% |
| 8 | 10 | 0 | 0 | 10 | 100% |
| 9 | 10 | 0 | 0 | 10 | 100% |
| 10 | 11 | 1 | 0 | 10 | 91% |

## Interview Transcript
<details>
<summary>Full Q&A (10 rounds)</summary>

### Round 1
**Q:** Are you proposing to replace the current 'editing' preset with 'compose' and insert a new 'script' preset — making the flow: recording → compose → script → export?
**A:** Yes, 4 presets in that order
**Ambiguity:** 72% (Goal: 0.40, Constraints: 0.10, Criteria: 0.10, Context: 0.60)

### Round 2
**Q:** In the new compose view, is it NLE-style timeline editing, storyboard-first structure, or both?
**A:** Both — storyboard + timeline (dual representation, changes to either sync)
**Ambiguity:** 65% (Goal: 0.55, Constraints: 0.15, Criteria: 0.10, Context: 0.65)

### Round 3
**Q:** What are the building blocks of the storyboard?
**A:** Step cards bundling segment+events+script (reorderable, intro/outro as special types)
**Ambiguity:** 59% (Goal: 0.65, Constraints: 0.15, Criteria: 0.15, Context: 0.70)

### Round 4
**Q:** How does 'assign script to actions based on metadata' work?
**A:** Per-step script with action markers — one script per step with [ACTION: ...] markers referencing DOM events
**Ambiguity:** 54% (Goal: 0.72, Constraints: 0.20, Criteria: 0.20, Context: 0.75)

### Round 5 (Contrarian)
**Q:** Why does script editing need its own dedicated preset rather than being a focused mode within compose?
**A:** Script preset IS needed — different focus. Compose = STRUCTURE, Script = CONTENT. Different mental modes need different UI layouts.
**Ambiguity:** 50% (Goal: 0.78, Constraints: 0.22, Criteria: 0.22, Context: 0.78)

### Round 6 (Simplifier)
**Q:** Do you really need per-step backend selection, or is a global setting sufficient?
**A:** "Allow a global default and if desired allow user to overwrite this for each step. We doubt this complexity is needed, but nice to have. Maybe construct an interface to interact with an AI framework and support different binaries/APIs."
**Ambiguity:** 44% (Goal: 0.80, Constraints: 0.40, Criteria: 0.25, Context: 0.80)

### Round 6b (Clarification)
**Q:** Does 'codex' mean the OpenAI Codex CLI tool? Should the interface abstract over CLI and HTTP?
**A:** Yes — codex CLI + unified interface. IAIProvider abstracts over CLI (claude, codex) and HTTP (ollama).
**Ambiguity:** 36% (Goal: 0.82, Constraints: 0.60, Criteria: 0.30, Context: 0.85)

### Round 7
**Q:** What should the script view layout look like?
**A:** Option 1 (full-width script editor with step context) BUT with video preview on right side and timeline below. Auto freeze frames when script too long. Script sections should span multiple events with easy markers.
**Ambiguity:** 34% (Goal: 0.88, Constraints: 0.55, Criteria: 0.30, Context: 0.88)

### Round 8
**Q:** How should the system estimate narration duration for auto freeze-frame insertion?
**A:** WPM calculation + user can adjust per-section (WPM as baseline, each section shows estimated duration, user can override freeze duration)
**Ambiguity:** 29% (Goal: 0.90, Constraints: 0.65, Criteria: 0.35, Context: 0.90)

### Round 9
**Q:** How should multi-event section grouping work in the script editor?
**A:** Drag events into sections — DOM events as draggable chips, user drags into script sections (1-N events per section)
**Ambiguity:** 26% (Goal: 0.93, Constraints: 0.70, Criteria: 0.40, Context: 0.92)

### Round 10
**Q:** Are the 13 acceptance criteria complete?
**A:** Complete — ready for spec (after adding: on AI error, show detailed error log with copy-paste button for external debugging)
**Ambiguity:** 9% (Goal: 0.95, Constraints: 0.85, Criteria: 0.90, Context: 0.92)

</details>
