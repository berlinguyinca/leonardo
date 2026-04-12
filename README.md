# Leonardo

Leonardo is a cross-platform Electron desktop application for AI-powered video tutorial production. It provides an NLE-style (non-linear editor) workflow similar to DaVinci Resolve or Premiere, but specifically designed for creating polished software tutorial videos with AI assistance.

The tool records your screen while capturing DOM events, generates narration scripts with AI, synthesizes speech, and composes everything into a professional tutorial video with freeze frames, zoom-ins, annotations, and transitions.

## Key Features

### 4 Input Modes

1. **Record First** — Record your screen, then generate AI narration
2. **Prompt First** — Write a script, then record to match it
3. **Simultaneous** — Record and narrate at the same time
4. **Fully Automatic** — AI drives the browser and generates everything (Playwright-based, future)

### AI Script Generation

- **Claude** — via `claude` CLI binary (no API key needed)
- **OpenAI** — via `codex` CLI binary (no API key needed)
- **Ollama** — Local AI via HTTP, works fully offline

No API key management required — the CLI tools handle their own authentication. Scripts include timing markers: `[PAUSE]`, `[ZOOM selector]`, `[FREEZE duration]`, `[TRANSITION type]`

### Text-to-Speech Pipeline

- **Piper** — Free, local, offline-capable TTS
- **ElevenLabs** — Premium cloud TTS with voice cloning
- SHA-256 content-based caching for incremental re-generation (only re-synthesizes changed sections)

### NLE-Style Timeline Editor

- Multi-track timeline with recording, audio, effects, and overlay tracks
- Color-coded sync point markers (freeze=blue, zoom=green, annotation=yellow, transition=purple)
- Drag-to-move segments and sync points
- Edge-handle resize for durations
- Playhead scrubbing with ref-driven rendering (no React re-renders during playback)
- Cursor-stable zoom (Cmd+scroll, 0.1x to 10x)
- Grid snap + sync point snap + segment edge snap (Alt to disable)

### Three Script Editor Views

1. **Script Only** — Full section-by-section editor with voice assignment and timing marker badges
2. **Split View** — Script editor + timeline minimap side by side with bi-directional sync
3. **Timeline** — Full timeline editor with inline text editing popups

Switch between views via toolbar segmented control or `Cmd+1/2/3`.

### Properties Panel

- Select a sync point or segment on the timeline
- Edit type, timestamp, duration, coordinates, annotation text
- Delete directly from the panel

### Sync Engine

- Automatically converts DOM events (clicks, navigation, form submissions, focus) into sync points
- AI refinement of sync point placement
- Conflict resolution by confidence scoring
- Narration duration adjustment for freeze frames

### FFmpeg Rendering

- Filtergraph builder: freeze frames, zoom-ins, fade transitions, overlays, audio mixing
- Codecs: H.264, H.265, ProRes
- Resolution: 1080p, 1440p, 4K

### Project Management

- `.leonardo` archive format (ZIP containing SQLite DB + media files)
- Auto-save every 30 seconds
- Full undo/redo on all editing operations (Zundo, 100-state history)
- Dark + light theme

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 41 |
| UI Framework | React 19 + TypeScript 6 (strict) |
| Build | electron-vite + Vite 7 |
| State Management | Zustand 5 + Zundo (undo/redo) |
| Rich Text Editor | Tiptap 3 (ProseMirror) |
| Drag & Drop | @dnd-kit (structural) + raw pointer events (timeline) |
| Event Bus | mitt |
| Database | better-sqlite3 (SQLite, WAL mode) |
| AI | `claude` CLI, `codex` CLI, Ollama REST |
| TTS | Piper (local), ElevenLabs (cloud) |
| Video | FFmpeg (child process) |
| Archive | adm-zip |
| Testing | Vitest 4 + React Testing Library |

## Project Status

Phases 1-6 are complete with 218 tests passing:

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | Done | Foundation: Electron scaffold, SQLite, types, interfaces, archive format, auto-save |
| 2 | Done | Recording Engine: Embedded webview browser, DOM event capture, FFmpeg conversion |
| 2.5 | Done | FFmpeg Spike: Filtergraph builder (freeze, zoom, fade, overlay, audio mix) |
| 3 | Done | AI Script Generation: Claude CLI, Codex CLI, Ollama providers (no API keys needed) |
| 4 | Done | TTS Pipeline: Piper + ElevenLabs providers, SHA-256 caching |
| 5 | Done | Sync Engine: DOM-to-sync conversion, conflict resolution, narration adjustment |
| 6 | Done | Timeline Editor & Script Editor: Multi-track timeline, 3 editor views, properties panel |
| 7+ | Planned | Clip library, preview player, export dialog, YouTube upload, DaVinci export |

## Getting Started

### Prerequisites

- **Node.js** 20+ and npm
- **Git**
- **FFmpeg** (for rendering) — install via `brew install ffmpeg` (macOS) or your system package manager
- **Claude CLI** (for Claude AI) — install [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- **Codex CLI** (for OpenAI) — install [OpenAI Codex](https://github.com/openai/codex)
- **Piper** (optional, for local TTS) — see [Piper releases](https://github.com/rhasspy/piper/releases)
- **Ollama** (optional, for local AI) — see [ollama.com](https://ollama.com)

### Installation

```bash
git clone <repo-url> leonardo
cd leonardo
npm install

# Rebuild native modules for Electron (required after npm install)
npx @electron/rebuild -f -w better-sqlite3
```

### Development

```bash
# Start the development server (hot-reload)
npm run dev

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check without emitting
npm run lint

# Build for production
npm run build

# Preview the production build
npm run preview
```

### Project Structure

```
leonardo/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, window creation, IPC registration
│   │   ├── ipc/                 # IPC handlers (project, recording, AI)
│   │   ├── services/            # Core services
│   │   │   ├── ai/              # AI providers (Claude, OpenAI, Ollama)
│   │   │   ├── tts/             # TTS providers (Piper, ElevenLabs)
│   │   │   ├── sync/            # Sync engine (DOM→sync, assembler)
│   │   │   ├── project-store.ts # SQLite persistence
│   │   │   └── archive.ts       # .leonardo zip export/import
│   │   ├── utils/               # FFmpeg bindings
│   │   └── workers/             # Background workers
│   ├── renderer/                # React UI
│   │   ├── components/
│   │   │   ├── layout/          # Workspace, Toolbar, PanelSystem, ViewModeToggle
│   │   │   ├── timeline/        # Timeline, TimeRuler, Playhead, TrackLane, Segment, etc.
│   │   │   ├── script-editor/   # ScriptOnlyView, DualPaneView, InlineEditorView, Tiptap
│   │   │   ├── properties/      # PropertiesPanel, SyncPointProperties, SegmentProperties
│   │   │   ├── browser/         # RecordingBrowser, RecordingControls
│   │   │   └── project/         # ProjectWizard
│   │   ├── hooks/               # usePlayhead, usePointerDrag, useTimelineZoom, etc.
│   │   ├── stores/              # Zustand stores (project, timeline, UI, recording)
│   │   └── styles/              # globals.css with dark/light theme
│   ├── shared/                  # Types, interfaces, constants
│   └── preload/                 # Electron preload (IPC bridge)
├── tests/
│   ├── unit/                    # Pure function and logic tests
│   └── integration/             # Component + store integration tests (real deps, no mocks)
├── docs/
│   └── superpowers/
│       ├── specs/               # Design specifications
│       └── plans/               # Implementation plans
└── resources/                   # Static assets, templates
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+1` | Script editor view |
| `Cmd+2` | Split view (script + timeline minimap) |
| `Cmd+3` | Timeline editor view |
| `Space` | Play / pause |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Delete` | Delete selected sync point or segment |
| `+` / `-` | Zoom in / out on timeline |
| `Cmd+Scroll` | Cursor-stable zoom |
| `Home` / `End` | Jump playhead to start / end |
| `Alt` (hold) | Disable snap while dragging |

## Configuration

### AI Providers

Leonardo invokes AI tools as local CLI binaries — no API keys are stored or managed by the app.

**Claude (recommended):**
Install the `claude` CLI and authenticate it once (`claude login`). Leonardo invokes `claude -p` in non-interactive mode with `--bare` to generate scripts. Default model: `claude-sonnet-4-20250514`.

**OpenAI (Codex):**
Install the `codex` CLI and authenticate it once. Leonardo invokes `codex exec` in sandbox mode. Default model: `gpt-4o`.

**Ollama (offline):**
Install Ollama and pull a model (e.g., `ollama pull llama3`). Leonardo connects to `localhost:11434` by default. No CLI binary needed — uses HTTP API directly.

### TTS Providers

**Piper (free, offline):**
Download a Piper voice model and point Leonardo to the binary + model path.

**ElevenLabs (premium):**
Set your ElevenLabs API key for high-quality cloud synthesis with voice cloning support.

## Testing

The project follows strict testing practices:

- **218 tests** across 23 test files
- **Unit tests** for pure functions (timeline math, snap logic, collision detection, script parsing, sync engine)
- **Integration tests** use real dependencies — real Zustand stores, real SQLite databases, real component rendering. No `vi.mock()` in integration tests.
- Tests run in ~2.5 seconds

```bash
# Run all tests
npm test

# Run a specific test file
npx vitest run tests/unit/timeline-utils.test.ts

# Run tests matching a pattern
npx vitest run --reporter=verbose timeline
```

## Troubleshooting

### `NODE_MODULE_VERSION` mismatch

If you see an error like:

```
was compiled against a different Node.js version using NODE_MODULE_VERSION X.
This version of Node.js requires NODE_MODULE_VERSION Y.
```

This means `better-sqlite3` was compiled for your system Node.js but Electron uses a different ABI. Fix it by rebuilding:

```bash
npx @electron/rebuild -f -w better-sqlite3
```

This must be re-run after switching Node.js versions or running a fresh `npm install`.

## Architecture

Leonardo follows a **pipeline architecture**: Recording → Script → TTS → Sync → Render → Export. Each stage has typed inputs/outputs and sits behind an interface.

**Process isolation:** Heavy work (FFmpeg, AI inference, TTS synthesis) runs in child processes/workers, never blocking the UI thread.

**Local-first, cloud-optional:** The app is fully functional offline with Ollama + Piper. Cloud services (Claude, ElevenLabs) are premium enhancements.

**State management:** Zustand stores with Zundo middleware provide undo/redo across all editing operations (100-state history). The timeline playhead uses ref-driven rendering with a mitt event emitter to avoid React re-renders during playback.

## License

MIT
