# Leonardo — Implementation Plan

> Source: Deep Interview Spec `.omc/specs/deep-interview-leonardo-video-production.md` (12% ambiguity, 16 rounds)

## RALPLAN-DR Summary

### Principles

1. **Pipeline-First Architecture** — The rendering pipeline (Recording → Script → TTS → Sync → Render → Export) is the core abstraction. All four input modes feed into it identically. Design every module as a pipeline stage with typed inputs/outputs.

2. **Progressive Capability** — Ship a working end-to-end flow (Mode 1 + basic timeline + H.264 export) first, then layer on advanced features (multi-track, clip library, voice cloning, Mode 4 automation). Each phase must be independently shippable and testable.

3. **Process Isolation for Heavy Work** — FFmpeg rendering, AI inference, and TTS synthesis must never block the UI thread. Use child processes / worker threads for all CPU/IO-intensive operations. The Electron main process orchestrates; it never does heavy lifting.

4. **Abstraction at Integration Boundaries** — AI backends, TTS engines, and export targets sit behind typed interfaces. Adding a new AI provider or TTS engine must not require changes to the pipeline core.

5. **Local-First, Cloud-Optional** — The app must be fully functional offline (with Ollama + Piper/Coqui). Cloud services (Claude API, ElevenLabs) are premium enhancements, never hard dependencies.

### Decision Drivers

1. **Time-to-first-demo** — A working Mode 1 → Script → TTS → Timeline → Export flow must be demonstrable as early as possible to validate the core value proposition.

2. **Recording fidelity** — The embedded browser must capture both high-quality video AND granular DOM events simultaneously, as this is the key differentiator enabling intelligent sync.

3. **Rendering quality** — The final output must match "YouTube tutorial quality" (polished intros, smooth freeze frames, zoom-ins, transitions). This requires robust FFmpeg orchestration and a compositing model, not just concatenation.

### Viable Options

#### Option A: Monolithic Electron (Single-Process Heavy)

**Approach:** All logic (UI, recording, AI, TTS, rendering) runs in the Electron main + renderer processes. FFmpeg called via `child_process.spawn()`.

**Pros:**
- Simplest deployment — single `.app` / `.exe`
- No IPC overhead between separate services
- Fewer moving parts for initial development

**Cons:**
- Main process becomes a bottleneck — long AI/TTS calls block IPC
- Hard to parallelize rendering + UI interaction
- Memory pressure from FFmpeg + Chromium + AI in one process tree
- Poor separation of concerns as complexity grows

#### Option B: Electron Shell + Local Backend Server

**Approach:** Electron handles UI only. A local Express/Fastify server (or Python FastAPI) handles AI, TTS, FFmpeg. Communication via localhost HTTP/WebSocket.

**Pros:**
- Clean separation: UI vs. processing
- Backend can be developed/tested independently
- Could reuse backend for a future web version

**Cons:**
- Complex deployment: must bundle and manage a separate server process
- Port conflicts, startup ordering, health checking add ops complexity
- Two different runtimes if Python is used for TTS (Coqui is Python-native)
- Overkill for a local desktop app with no multi-user requirements

#### Option C: Electron + Worker Architecture (Recommended)

**Approach:** Electron main process for orchestration. Renderer for UI (React). Dedicated child processes for heavy work:
- **Recording Worker** — manages embedded browser capture + DOM event stream
- **AI Worker** — handles script generation (API calls or Ollama subprocess)
- **TTS Worker** — manages Piper/Coqui subprocess or ElevenLabs API calls
- **Render Worker** — orchestrates FFmpeg for video composition

Communication via Electron IPC (main↔renderer) and Node.js `child_process`/`worker_threads` (main↔workers).

**Pros:**
- UI never blocks — heavy work is fully isolated
- Each worker can be developed, tested, and crashed independently
- Single deployment artifact (Electron app)
- Natural parallelism: render while editing, TTS while reviewing
- FFmpeg, Piper, Playwright each get their own process — no resource contention

**Cons:**
- More IPC plumbing than monolithic
- Worker lifecycle management adds complexity
- Serialization overhead for large data (video frames) across process boundaries

**Why this is recommended:** It preserves the deployment simplicity of a single Electron app while isolating the four heaviest subsystems (recording, AI, TTS, rendering) into separate processes. This directly addresses the risk of UI freezes during long operations — a deal-breaker for an NLE-style app where the user expects responsive interaction at all times.

**Invalidation rationale for alternatives:**
- **Option A** is invalidated by the NLE-style UI requirement. Users interacting with a timeline editor cannot tolerate UI freezes during rendering or AI calls. A monolithic approach would require extensive manual async orchestration that worker isolation provides naturally.
- **Option B** is invalidated by the "runs locally, no server" constraint and deployment complexity. Managing a separate server process adds failure modes without any benefit since this is a single-user desktop app.

---

### NLE-Style Scope Clarification

Leonardo provides an **NLE-style editing workflow** (multi-track timeline, drag-and-drop, sync point editing, workspace panels) with **render-to-preview playback**. It does NOT target real-time multi-track video compositing. Electron's Chromium renderer cannot deliver frame-accurate GPU-accelerated video scrubbing like DaVinci Resolve or Premiere. The UX model is: edit timeline structure → quick-preview (thumbnail strips + cached short-segment renders) → full render-to-file. The DaVinci/Premiere comparison applies to the **workflow paradigm** (panels, timeline, keyboard shortcuts), not to playback performance.

---

## Requirements Summary

Build Leonardo, a cross-platform Electron desktop app for AI-powered video tutorial production:
- 4 input modes feeding one rendering pipeline
- NLE-style UI (DaVinci Resolve / Premiere-inspired)
- Hybrid AI (Claude, OpenAI, Ollama) for script generation
- Two-tier TTS (Piper/Coqui local, ElevenLabs cloud)
- Automatic sync timeline generation (DOM events + AI) with user review
- Multi-track composition with clip library
- Three script editing views with per-section voice assignment
- Export: H.264/H.265/ProRes files, YouTube API upload, DaVinci Resolve via FCPXML (documented format)
- Configurable recording resolution (1080p–4K)

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop Shell | Electron 33+ | Cross-platform, embedded Chromium for recording |
| UI Framework | React 19 + TypeScript (strict) | Rich ecosystem for complex UIs, strong typing |
| State Management | Zustand | Lightweight, TypeScript-native, no boilerplate |
| UI Components | Custom NLE components + Radix UI primitives | No off-the-shelf NLE library exists; Radix for accessibility |
| Styling | Tailwind CSS + CSS Modules | Utility-first with component scoping for complex layouts |
| Video Processing | FFmpeg (bundled via ffmpeg-static) | Industry standard, all codecs, cross-platform |
| Recording | Electron desktopCapturer + MediaRecorder | Native Electron API for BrowserView capture |
| Browser Automation | Playwright (Mode 4) | Best-in-class browser automation, Chromium-native |
| AI — Cloud | Anthropic SDK, OpenAI SDK | Official SDKs for Claude and OpenAI/Codex |
| AI — Local | Ollama REST API (localhost:11434) | Standard local LLM runtime |
| TTS — Free | Piper TTS (bundled binary) | High-quality local TTS, small footprint, cross-platform |
| TTS — Cloud | ElevenLabs SDK | Voice cloning, professional quality |
| Persistence | better-sqlite3 | Embedded SQL for projects, clip library, settings |
| YouTube | googleapis (youtube v3) | Official Google API client |
| DaVinci Export | FCPXML generator (documented format) | DaVinci Resolve imports FCPXML; .drp is proprietary/undocumented — stretch goal only |
| Testing | Vitest + Playwright (E2E) + Electron Testing Library | Fast unit tests, real browser E2E |
| Build | electron-builder | Cross-platform packaging (dmg, exe, AppImage) |

## Project Structure

```
leonardo/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── src/
│   ├── main/                          # Electron main process
│   │   ├── index.ts                   # App entry, window management
│   │   ├── ipc/                       # IPC handlers (main↔renderer)
│   │   │   ├── project.ipc.ts
│   │   │   ├── recording.ipc.ts
│   │   │   ├── ai.ipc.ts
│   │   │   ├── tts.ipc.ts
│   │   │   ├── render.ipc.ts
│   │   │   └── export.ipc.ts
│   │   ├── workers/                   # Child process workers
│   │   │   ├── recording-worker.ts
│   │   │   ├── ai-worker.ts
│   │   │   ├── tts-worker.ts
│   │   │   └── render-worker.ts
│   │   ├── services/                  # Main process services
│   │   │   ├── project-store.ts       # SQLite project persistence
│   │   │   ├── clip-library.ts        # Persistent clip library
│   │   │   └── settings.ts            # App settings management
│   │   └── utils/
│   │       ├── ffmpeg.ts              # FFmpeg process management
│   │       └── paths.ts               # Platform-specific paths
│   │
│   ├── renderer/                      # React UI (renderer process)
│   │   ├── App.tsx
│   │   ├── main.tsx                   # Renderer entry
│   │   ├── components/
│   │   │   ├── layout/                # NLE workspace layout
│   │   │   │   ├── Workspace.tsx      # Main workspace container
│   │   │   │   ├── PanelSystem.tsx    # Resizable panel layout
│   │   │   │   └── Toolbar.tsx
│   │   │   ├── timeline/              # Multi-track timeline editor
│   │   │   │   ├── Timeline.tsx       # Main timeline component
│   │   │   │   ├── Track.tsx          # Individual track
│   │   │   │   ├── Segment.tsx        # Timeline segment (clip/recording)
│   │   │   │   ├── SyncPoint.tsx      # Sync point marker
│   │   │   │   ├── Playhead.tsx       # Current position indicator
│   │   │   │   └── ZoomControls.tsx
│   │   │   ├── script-editor/         # Three-view script editing
│   │   │   │   ├── ScriptOnlyView.tsx
│   │   │   │   ├── DualPaneView.tsx
│   │   │   │   ├── InlineEditor.tsx
│   │   │   │   └── VoiceAssignment.tsx
│   │   │   ├── browser/               # Embedded browser for recording
│   │   │   │   ├── RecordingBrowser.tsx
│   │   │   │   └── RecordingControls.tsx
│   │   │   ├── preview/               # Video preview panel
│   │   │   │   └── PreviewPlayer.tsx
│   │   │   ├── clip-library/          # Clip library panel
│   │   │   │   ├── LibraryPanel.tsx
│   │   │   │   ├── ClipThumbnail.tsx
│   │   │   │   └── ImportDialog.tsx
│   │   │   ├── project/               # Project management
│   │   │   │   ├── ProjectWizard.tsx  # New project + input mode selection
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   └── ProjectSettings.tsx
│   │   │   ├── export/                # Export dialog
│   │   │   │   ├── ExportDialog.tsx
│   │   │   │   ├── YouTubeUpload.tsx
│   │   │   │   └── DaVinciExport.tsx
│   │   │   └── settings/              # App settings
│   │   │       ├── AISettings.tsx
│   │   │       ├── TTSSettings.tsx
│   │   │       └── GeneralSettings.tsx
│   │   ├── hooks/                     # React hooks
│   │   │   ├── useProject.ts
│   │   │   ├── useTimeline.ts
│   │   │   ├── useRecording.ts
│   │   │   ├── useDragDrop.ts
│   │   │   └── useIPC.ts
│   │   ├── stores/                    # Zustand stores
│   │   │   ├── project-store.ts
│   │   │   ├── timeline-store.ts
│   │   │   ├── ui-store.ts
│   │   │   └── recording-store.ts
│   │   └── styles/
│   │       ├── globals.css
│   │       └── themes/
│   │           ├── dark.css
│   │           └── light.css
│   │
│   ├── shared/                        # Shared types and interfaces
│   │   ├── types/
│   │   │   ├── project.ts             # Project, Recording, Script types
│   │   │   ├── timeline.ts            # SyncTimeline, SyncPoint, Track types
│   │   │   ├── ai.ts                  # AIBackend, ScriptGenRequest types
│   │   │   ├── tts.ts                 # TTSEngine, VoiceProfile types
│   │   │   ├── export.ts              # ExportTarget, Codec types
│   │   │   └── events.ts             # DOMEvent, RecordingEvent types
│   │   ├── interfaces/
│   │   │   ├── ai-provider.ts         # IAIProvider interface
│   │   │   ├── tts-provider.ts        # ITTSProvider interface
│   │   │   ├── export-provider.ts     # IExportProvider interface
│   │   │   └── input-mode.ts          # IInputMode interface (defined Phase 1)
│   │   └── constants.ts
│   │
│   └── preload/                       # Electron preload scripts
│       └── index.ts                   # Exposes IPC bridge to renderer
│
├── resources/                         # Bundled resources
│   ├── templates/                     # Intro/outro templates
│   │   ├── default-intro/
│   │   └── default-outro/
│   └── ffmpeg/                        # Bundled FFmpeg binaries
│
├── tests/
│   ├── unit/                          # Vitest unit tests
│   ├── integration/                   # Integration tests (real FFmpeg, real DB)
│   └── e2e/                           # Playwright E2E tests
│
├── scripts/
│   ├── dev-start.sh
│   └── dev-stop.sh
│
└── .ai-codex/                         # Codebase index
```

## Implementation Phases

### Phase 1: Foundation (Scaffold + Data Model)

**Goal:** Electron app boots, shows NLE-style layout with resizable panels, projects can be created and persisted.

**Steps:**

1.1. **Initialize Electron + React project**
   - Use `electron-vite` for build tooling (Vite for renderer, esbuild for main)
   - TypeScript strict mode, ESLint, Prettier
   - `package.json` with Electron 33+, React 19, TypeScript 5.6+

1.2. **Define shared types** (`src/shared/types/`)
   - `Project`: id, name, inputMode, status, createdAt, exportConfig
   - `Recording`: videoFile, domEvents[], duration, url, resolution
   - `Script`: text, sections[], timingMarkers[], aiBackend, prompt
   - `ScriptSection`: id, text, voiceProfileId, startTime, endTime
   - `SyncTimeline`: syncPoints[], tracks[], duration, reviewed
   - `SyncPoint`: timestamp, type (freeze/zoom/annotation), source, duration, coordinates
   - `Track`: type (recording/clip/overlay/audio), segments[], zOrder
   - `VoiceProfile`: name, samples[], provider, voiceId
   - `ExportTarget`: type (file/youtube/davinci), codec, resolution, settings

1.3. **Define provider and input mode interfaces** (`src/shared/interfaces/`)
   - `IAIProvider`: `generateScript(prompt: string, context: ScriptGenContext): Promise<Script>` where `ScriptGenContext = { domEvents: DOMEvent[], recordingDuration: number, url: string, userPrompt: string }`
   - `IAIProvider.refineSyncPoints(script: Script, domEvents: DOMEvent[]): Promise<SyncPoint[]>` — separate method for sync refinement (not reusing `generateScript`)
   - `ITTSProvider`: `synthesize(text: string, voice: VoiceProfile): Promise<{ filePath: string, duration: number }>`, `getVoices(): VoiceProfile[]` — returns file path, not AudioBuffer (workers run in Node.js, not Web Audio)
   - `IExportProvider`: `export(project: Project, target: ExportTarget): Promise<ExportResult>` where `ExportResult = { success: boolean, outputPath?: string, url?: string, error?: string }`
   - `IInputMode`: `start(): Promise<void>`, `getRecording(): Recording`, `getScript(): Script`, `getDOMEvents(): DOMEvent[]` — defined NOW, not Phase 10. Mode 1 implements this interface from Phase 2 onward.

1.4. **Set up SQLite persistence** (`src/main/services/project-store.ts`)
   - Schema: projects, recordings, scripts, script_sections, sync_timelines, sync_points, tracks, voice_profiles, clip_library, clips
   - Migrations via `better-sqlite3-migrations`

1.5. **Build NLE workspace layout** (`src/renderer/components/layout/`)
   - Resizable panel system (allotment or custom)
   - 4 panels: Browser/Preview (top-left), Properties (top-right), Timeline (bottom), Library (left sidebar)
   - Dark theme by default, light theme support
   - Workspace presets (Recording, Editing, Export)

1.6. **Build project wizard** (`src/renderer/components/project/ProjectWizard.tsx`)
   - New project dialog: name, input mode selection (4 cards), recording resolution selector
   - Project list view for recent projects

1.7. **Set up IPC bridge** (`src/preload/index.ts`, `src/main/ipc/`)
   - Type-safe IPC using `electron-trpc` or custom typed channels
   - Project CRUD operations

1.8. **Undo/redo architecture** (`src/renderer/stores/`)
   - Use `zundo` middleware (Zustand temporal middleware) for undo/redo on all editing stores
   - Command pattern: every user action (move sync point, edit script, reorder track) is an undoable command
   - Stores that support undo: `timeline-store`, `script-store`, `project-store`
   - Keyboard shortcuts: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
   - Undo history limit: 100 actions (configurable)

1.9. **Worker lifecycle and crash recovery protocol**
   - Each worker type has defined semantics:
     - **Crash detection**: heartbeat ping every 5s, 3 missed pings = crash detected
     - **Auto-restart**: crashed workers restart automatically, user notified via toast
     - **State recovery**: workers save checkpoint files periodically
     - **Render worker**: saves progress per FFmpeg stage; on crash, resumes from last completed stage
     - **AI worker**: streaming responses save partial script; on crash, retry from last complete section
     - **TTS worker**: per-section caching means crash loses at most one section's audio
   - IPC error protocol: all worker messages include `{ status: 'ok' | 'error' | 'crash', payload, workerId }`

1.10. **Auto-save system**
   - Auto-save every 30 seconds when changes are detected (debounced)
   - Saves: project state, timeline state, script state to SQLite
   - Crash recovery: on startup, detect dirty shutdown flag → offer to restore auto-saved state
   - Auto-save indicator in status bar

1.11. **Project file format** (`.leonardo` archive)
   - Zip-based archive containing: SQLite project DB + linked media files + thumbnails + settings
   - Import/export `.leonardo` files for portability (share projects, backups)
   - Internal working format remains SQLite; `.leonardo` archive is for export/import

**Acceptance Criteria:**
- [ ] `npm run dev` starts Electron app with NLE-style layout (4 resizable panels)
- [ ] Dark and light themes work
- [ ] Projects can be created with name + input mode selection
- [ ] Projects persist across app restarts (SQLite)
- [ ] All shared types compile with TypeScript strict
- [ ] Undo/redo works on placeholder editing operations (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
- [ ] Worker crash recovery: kill a worker process → it auto-restarts with user notification
- [ ] Auto-save triggers every 30s on change; crash recovery offers restore on dirty startup
- [ ] IInputMode interface defined and compilable

**Tests:**
- Unit: Project CRUD operations, type serialization
- Integration: SQLite persistence (real DB)
- E2E: App launches, create project wizard flow

---

### Phase 2: Recording Engine

**Goal:** User can navigate to a website in the embedded browser and record their interactions with synchronized DOM event capture.

**Steps:**

2.1. **Embedded browser component** (`src/renderer/components/browser/RecordingBrowser.tsx`)
   - Use Electron's `<webview>` tag or `BrowserView`
   - URL bar, back/forward, refresh controls
   - Configurable viewport size matching target resolution (1080p/1440p/4K)

2.2. **DOM event capture injection**
   - Inject content script via `webContents.executeJavaScript()` on page load
   - Capture: click (element, coordinates), form submit, input focus/blur, page navigation, scroll
   - Events include: timestamp, element CSS selector, coordinates, event type, element text content
   - Stream events to main process via `webContents.ipc`

2.3. **Screen recording via desktopCapturer**
   - Use `desktopCapturer.getSources()` to capture the BrowserView window
   - MediaRecorder API with VP9/H.264 codec for intermediate format
   - Recording controls: Start, Pause, Resume, Stop
   - Timer display during recording
   - Save raw recording to temp directory as WebM

2.4. **Recording worker** (`src/main/workers/recording-worker.ts`)
   - Manages recording lifecycle in a child process
   - Converts WebM → MP4 (H.264) via FFmpeg post-recording
   - Stores DOM events JSON alongside video file
   - Reports progress back to main process

2.5. **Recording resolution management**
   - Settings for target resolution (1080p: 1920x1080, 1440p: 2560x1440, 4K: 3840x2160)
   - BrowserView/webview resizes to match target resolution
   - DPI-aware scaling for Retina/HiDPI displays

**Acceptance Criteria:**
- [ ] User can navigate to any URL in the embedded browser
- [ ] Recording captures the browser viewport at the configured resolution
- [ ] DOM events (clicks, form submits, navigation) are captured with timestamps
- [ ] Recording saves as H.264 MP4 with accompanying DOM events JSON
- [ ] Recording resolution is configurable (1080p, 1440p, 4K)
- [ ] UI remains responsive during recording (no freezes)

**Tests:**
- Unit: DOM event serialization, resolution calculation
- Integration: FFmpeg WebM→MP4 conversion (real FFmpeg)
- E2E: Navigate to URL, start recording, perform actions, stop recording, verify output files

2.6. **Spike: Playwright-in-Electron feasibility** (2-hour timebox)
   - Validate that Playwright can run inside Electron using Electron's Chromium as the browser executable
   - If it cannot, document the alternative: Playwright launches its own Chromium and the recording worker captures it externally
   - This de-risks Phase 10 (Mode 4) — do NOT wait until Phase 10 to discover infeasibility

---

### Phase 2.5: Rendering Spike (FFmpeg Validation)

**Goal:** Validate FFmpeg composition quality BEFORE building 6 phases of dependent infrastructure. This is the highest-risk technical component.

**Steps:**

2.5.1. **Minimal FFmpeg pipeline**
   - Input: a test screen recording (MP4), a set of hardcoded sync points
   - Build an FFmpeg filtergraph that applies:
     - Freeze frame at timestamp T for duration D
     - Zoom-in effect (crop + scale) targeting coordinates (x, y, w, h) with ease-in/ease-out
     - Fade transition between two segments
   - Output: H.264 MP4 with all effects applied

2.5.2. **FFmpeg command builder abstraction** (`src/main/utils/ffmpeg.ts`)
   - Composable filtergraph builder: chain effects as function calls
   - Unit tests for each effect's filtergraph string
   - Validate output with FFprobe (correct duration, resolution, codec)

2.5.3. **Multi-track composition test**
   - Layer a test overlay (PNG image) on top of the recording at specific time range
   - Mix an audio file (WAV) with the video
   - Verify output has correct video + audio + overlay

2.5.4. **GPU-accelerated encoding test**
   - Test if bundled FFmpeg binary supports hardware encoding:
     - macOS: VideoToolbox (`-c:v h264_videotoolbox`)
     - Windows: NVENC (`-c:v h264_nvenc`) and QSV
     - Linux: VAAPI (`-c:v h264_vaapi`)
   - Document which platforms get hardware acceleration
   - Fallback: software encoding (libx264) on all platforms

2.5.5. **Benchmark: render time vs. video duration**
   - Time a 2-minute test video render on standard hardware
   - Target: < 2x realtime for 1080p H.264 with effects
   - If target missed, investigate hardware encoding or simpler filtergraph

**Acceptance Criteria:**
- [ ] FFmpeg freeze frame effect produces correct visual output (frame held for specified duration)
- [ ] FFmpeg zoom-in effect crops and scales correctly with smooth easing
- [ ] FFmpeg fade transition works between segments
- [ ] Multi-track overlay compositing works (video + overlay + audio)
- [ ] H.264, H.265, and ProRes output files are valid and playable
- [ ] GPU-accelerated encoding tested on at least one platform
- [ ] Render benchmark documented (time per minute of source video)
- [ ] FFmpeg command builder has unit tests for each effect type

**Exit Criteria:** If any core effect (freeze frame, zoom-in) cannot be achieved via FFmpeg filtergraphs with acceptable quality, STOP and re-evaluate the rendering approach before proceeding to Phase 3.

---

### Phase 3: AI Script Generation

**Goal:** User provides a prompt + recording metadata, and the system generates a narration script via pluggable AI backends.

**Steps:**

3.1. **AI provider interface implementation**
   - `ClaudeProvider`: Anthropic SDK, `messages.create()` with system prompt
   - `OpenAIProvider`: OpenAI SDK, `chat.completions.create()`
   - `OllamaProvider`: REST API to `localhost:11434/api/chat`
   - All implement `IAIProvider` interface

3.2. **Script generation prompt engineering**
   - System prompt: "You are a video tutorial scriptwriter. Given a recording description and DOM events, write a clear, engaging narration script."
   - Include DOM events summary (clicks, navigations, form fills with timestamps)
   - Include user's prompt/description
   - Output: structured script with sections, timing hints, and [PAUSE], [ZOOM:selector], [FREEZE] markers

3.3. **AI worker** (`src/main/workers/ai-worker.ts`)
   - Runs API calls in child process to avoid blocking
   - Supports streaming responses (show script generation progress)
   - Error handling: timeout, rate limits, offline fallback
   - Provider switching without project data loss

3.4. **AI settings UI** (`src/renderer/components/settings/AISettings.tsx`)
   - Provider selection (Claude, OpenAI, Ollama)
   - API key management (encrypted storage via `safeStorage`)
   - Ollama model selection (pulls available models list)
   - Test connection button

3.5. **Script data model**
   - Script stored as array of `ScriptSection` objects
   - Each section: id, text, voiceProfileId, timingMarkers[], estimatedDuration
   - Timing markers: [PAUSE duration], [ZOOM selector], [FREEZE duration], [TRANSITION type]

**Acceptance Criteria:**
- [ ] Script generated from prompt + DOM events in < 30s for 2-minute recording (cloud API)
- [ ] Works with Claude API (cloud)
- [ ] Works with OpenAI API (cloud)
- [ ] Works with Ollama (local, offline)
- [ ] Switching AI backend in settings doesn't affect existing project scripts
- [ ] Generated script includes timing markers ([PAUSE], [ZOOM], [FREEZE])
- [ ] API keys stored securely (Electron safeStorage)

**Tests:**
- Unit: Prompt template construction, script parsing, marker extraction
- Integration: Claude API call (real API), Ollama call (real local model)
- E2E: Generate script from recording, verify script appears in editor

---

### Phase 4: TTS Pipeline

**Goal:** Convert script sections to audio narration using local (Piper) or cloud (ElevenLabs) TTS with per-section voice assignment.

**Steps:**

4.1. **TTS provider interface implementation**
   - `PiperProvider`: Spawn Piper binary as child process, pipe text → WAV
   - `CoquiProvider`: Alternative local TTS (optional, if Piper insufficient)
   - `ElevenLabsProvider`: ElevenLabs SDK, `textToSpeech()` with voice cloning

4.2. **TTS worker** (`src/main/workers/tts-worker.ts`)
   - Processes script sections sequentially or in parallel (configurable)
   - Incremental re-generation: only re-synthesize changed sections
   - Caches audio by section hash (text + voice + engine)
   - Outputs WAV files per section + combined audio track

4.3. **Voice profile management**
   - Voice profile CRUD in SQLite
   - For ElevenLabs: upload voice samples, create/manage cloned voices
   - For Piper: select from bundled voice models
   - Voice preview: play sample audio before assigning

4.4. **Per-section voice assignment**
   - Each `ScriptSection` has a `voiceProfileId`
   - Default voice for new sections
   - Voice change triggers incremental TTS for affected section only

4.5. **TTS settings UI** (`src/renderer/components/settings/TTSSettings.tsx`)
   - Engine selection (Piper, ElevenLabs)
   - Piper: voice model selection, speed/pitch controls
   - ElevenLabs: API key, voice library, upload samples for cloning
   - Preview button per voice

**Acceptance Criteria:**
- [ ] Piper TTS produces listenable audio from script text (local, offline)
- [ ] ElevenLabs produces professional-quality narration from cloned voice
- [ ] Different voices assignable to different script sections
- [ ] Editing a single section only re-generates that section's audio
- [ ] Audio cache prevents redundant TTS calls
- [ ] TTS runs in background without blocking UI

**Tests:**
- Unit: Section hash calculation, cache lookup, voice assignment logic
- Integration: Piper TTS synthesis (real binary), ElevenLabs API (real API)
- E2E: Assign voices to sections, generate audio, verify playback

---

### Phase 5: Sync Engine

**Goal:** Automatically generate a sync timeline from DOM events + AI script analysis, producing sync points (freeze frames, zoom-ins, annotations).

**Steps:**

5.1. **DOM event to sync point conversion**
   - Map click events → freeze frame candidates (pause at click moment)
   - Map form submissions → annotation candidates (highlight form area)
   - Map page navigations → transition candidates (scene break)
   - Map input focus → zoom-in candidates (zoom to input field)
   - Each candidate has: timestamp, type, confidence score, DOM coordinates

5.2. **AI-based script analysis for sync points**
   - Send script + DOM events to AI backend
   - AI identifies additional sync points from narration flow
   - AI selects which DOM-event candidates to keep vs. skip
   - AI adjusts timing to match narration pacing
   - Output: merged sync point list with sources (dom/script/hybrid)

5.3. **Sync timeline assembly**
   - Merge DOM-based and AI-based sync points
   - Resolve conflicts (overlapping sync points, too-close timing)
   - Calculate freeze frame durations based on narration length for that segment
   - Auto-insert transitions between major sections
   - Output: `SyncTimeline` with ordered `SyncPoint[]`

5.4. **Timeline data model**
   - Sync points are positioned on a time axis
   - Each sync point references: a recording timestamp, an effect type, duration, and target coordinates
   - Multi-track model: recording track, audio track, effects track, overlay track

**Acceptance Criteria:**
- [ ] DOM events automatically generate sync point candidates
- [ ] AI refines and selects sync points based on script content
- [ ] Freeze frames inserted at click events with appropriate duration
- [ ] Zoom-ins target correct UI areas based on DOM element coordinates
- [ ] Transitions inserted at page navigation points
- [ ] Sync timeline data model supports multi-track layout

**Tests:**
- Unit: DOM event → sync point conversion, conflict resolution, timing calculation
- Integration: AI sync analysis with real AI backend
- E2E: Record interactions, generate script, generate sync timeline, verify sync points match events

---

### Phase 6: Timeline Editor & Script Editor

**Goal:** NLE-style multi-track timeline editor for reviewing/adjusting sync points, plus three-view script editor with voice assignment.

**Steps:**

6.1. **Timeline component** (`src/renderer/components/timeline/Timeline.tsx`)
   - Horizontal scrollable timeline with time ruler
   - Multiple tracks rendered as horizontal lanes
   - Track types: Recording (video), Audio (narration), Effects (freeze/zoom), Overlay (clips)
   - Playhead with scrubbing
   - Zoom in/out on time axis

6.2. **Sync point visualization and editing**
   - Sync points shown as markers on the effects track
   - Drag to reposition (changes timestamp)
   - Resize to change duration (for freeze frames)
   - Right-click context menu: delete, change type, edit properties
   - Color-coded by type: freeze (blue), zoom (green), annotation (yellow), transition (purple)

6.3. **Track segment display**
   - Recording track shows video thumbnails at intervals
   - Audio track shows waveform visualization
   - Segments are draggable and resizable on tracks
   - Snap-to-grid and snap-to-sync-point behavior

6.4. **Script-Only View** (`src/renderer/components/script-editor/ScriptOnlyView.tsx`)
   - Full-text editor for the script (ContentEditable or Monaco/CodeMirror)
   - Paragraph-level editing with section boundaries
   - Voice assignment dropdown per paragraph/section
   - Timing markers shown as inline badges

6.5. **Dual-Pane View** (`src/renderer/components/script-editor/DualPaneView.tsx`)
   - Left pane: script editor (paragraph-level)
   - Right pane: timeline (minimap view)
   - Click paragraph → scroll timeline to corresponding segment (and highlight)
   - Click timeline segment → scroll script to corresponding paragraph
   - Bi-directional sync via shared selection state

6.6. **Inline Timeline Editing** (`src/renderer/components/script-editor/InlineEditor.tsx`)
   - Click audio/narration segment on timeline → popup text editor
   - Edit narration text in-place
   - Voice dropdown in popup
   - Changes trigger incremental TTS re-generation

6.7. **Drag & drop foundation**
   - `useDragDrop` hook using HTML5 Drag and Drop API
   - Internal DnD: segments between tracks, reorder within tracks
   - Visual feedback: drop targets, ghost elements, snap indicators

**Acceptance Criteria:**
- [ ] Timeline shows multiple tracks with segments
- [ ] Sync points are visualized as color-coded markers
- [ ] Sync points can be moved, resized, deleted, and type-changed
- [ ] Playhead scrubs through the timeline
- [ ] Script-only view supports full-text editing with voice assignment
- [ ] Dual-pane view syncs paragraph selection ↔ timeline position
- [ ] Inline editing allows text/voice changes directly on timeline
- [ ] Drag and drop works for segments within the timeline

**Tests:**
- Unit: Timeline position calculations, segment collision detection, drag snap logic
- Integration: Script edit → TTS re-generation → timeline update
- E2E: Open project, switch between 3 editor views, edit script, drag sync points, verify changes persist

---

### Phase 7: Clip Library & Multi-Track Composition

**Goal:** Persistent clip library with import/export, multi-track timeline composition, and full drag & drop (internal, external files, cross-project).

**Steps:**

7.1. **Clip library data model and persistence**
   - SQLite tables: clips (id, name, filePath, type, duration, thumbnail, tags, projectId, isGlobal)
   - Global library vs. project-specific clips
   - Auto-generate thumbnails on import (FFmpeg frame extraction)
   - Tag system for organization

7.2. **Library panel UI** (`src/renderer/components/clip-library/`)
   - Grid/list view of clips with thumbnails
   - Search and filter by type (video/audio/image) and tags
   - Import button (file dialog)
   - Right-click: rename, tag, delete, show in folder

7.3. **External file drag & drop**
   - Handle `drop` events on the library panel and timeline
   - Accept files from OS file manager (Finder/Explorer)
   - Auto-detect file type (video/audio/image)
   - Auto-import: copy to project directory, create clip entry, generate thumbnail

7.4. **Multi-track composition**
   - Recording track: main screen recording
   - Clip tracks: imported video clips placed at specific times
   - Audio tracks: narration, background music, sound effects
   - Overlay track: picture-in-picture, logos, annotations
   - Track add/remove/reorder

7.5. **Cross-project drag & drop**
   - Multi-tab project support (Electron BrowserWindow or tabs)
   - Drag clip from one project's library to another project's timeline
   - Copy-on-drop semantics (copies file, creates new clip entry)

7.6. **Clip operations on timeline**
   - Place clips by dragging from library to specific track + time position
   - Trim clips (drag edges)
   - Split clips (cut at playhead)
   - Cross-fade between adjacent clips on same track

**Acceptance Criteria:**
- [ ] Clip library persists across projects (global library)
- [ ] External files can be imported via file dialog or drag & drop from OS
- [ ] Auto-generated thumbnails for video clips
- [ ] Multi-track timeline supports: recording, clip, audio, and overlay tracks
- [ ] Clips can be dragged from library to timeline
- [ ] Cross-project clip sharing via drag & drop
- [ ] Clips can be trimmed, split, and cross-faded on timeline

**Tests:**
- Unit: File type detection, thumbnail generation command, clip data model
- Integration: FFmpeg thumbnail extraction (real FFmpeg), SQLite clip persistence (real DB)
- E2E: Import clips, drag to timeline, trim, split, verify playback

---

### Phase 8: Rendering Pipeline

**Goal:** Compose the final video from all timeline tracks, applying freeze frames, zoom-ins, transitions, and intros/outros. Background rendering with progress.

**Steps:**

8.1. **Render worker** (`src/main/workers/render-worker.ts`)
   - Orchestrates FFmpeg commands in a child process
   - Accepts: SyncTimeline, Recording, Audio files, Clip references, Intro/Outro templates
   - Outputs: rendered video file in specified codec

8.2. **FFmpeg composition pipeline**
   - Stage 1: Pre-process recording (scale to target resolution)
   - Stage 2: Apply effects per sync point:
     - Freeze frame: extract frame at timestamp, hold for duration
     - Zoom-in: crop + scale region around target coordinates, ease-in/ease-out
     - Annotation: overlay text/graphics at position
   - Stage 3: Apply transitions between segments (fade, dissolve, cut)
   - Stage 4: Compose multi-track (overlay clips, PIP)
   - Stage 5: Mix audio (narration track + any background audio)
   - Stage 6: Prepend intro, append outro
   - Stage 7: Encode to target codec (H.264/H.265/ProRes)

8.3. **Intro/outro template system**
   - Templates stored as HTML/CSS rendered to video via Electron offscreen renderer
   - Default templates: title card (title, subtitle, date), CTA card (subscribe, next video)
   - Template variables: `{{title}}`, `{{description}}`, `{{topics}}`, `{{cta_text}}`
   - AI fills variables from script content
   - User can edit filled values before render
   - Custom template import (HTML + CSS + assets)

8.4. **Background rendering with progress**
   - Render runs in worker process, UI fully responsive
   - Progress bar: parsing → pre-processing → effects → composition → encoding
   - Cancel support (kill FFmpeg process)
   - Render queue for multiple exports

8.5. **Render preview**
   - Quick preview at lower resolution (720p, faster encode)
   - Preview specific timeline sections without full render

**Acceptance Criteria:**
- [ ] Full render produces polished video with intro, effects, transitions, outro
- [ ] Freeze frames hold the correct frame for the specified duration
- [ ] Zoom-ins target the correct UI area with smooth easing
- [ ] Transitions (fade, dissolve) work between segments
- [ ] Multi-track clips are composited correctly (overlays on top)
- [ ] Audio is mixed (narration + clips)
- [ ] Intro/outro templates render with AI-generated content
- [ ] Background rendering doesn't block UI
- [ ] Progress bar accurately reflects rendering stages
- [ ] H.264, H.265, ProRes codecs all produce valid output

**Tests:**
- Unit: FFmpeg command construction, effect parameter calculation, template variable substitution
- Integration: Full render pipeline (real FFmpeg), codec validation
- E2E: Create project → record → script → sync → render → verify output video plays correctly
- Performance: Render a 5-minute tutorial in < 3 minutes on standard hardware

---

### Phase 9: Export Pipeline

**Goal:** Export rendered videos to files (multiple codecs), YouTube (direct API upload), and DaVinci Resolve (via FCPXML).

**Steps:**

9.1. **File export** (baseline)
   - Export dialog: codec selection, resolution, quality/bitrate, output path
   - Codecs: H.264 (MP4), H.265/HEVC (MP4), ProRes (MOV)
   - Resolution: match recording or custom
   - Triggers render worker with selected settings

9.2. **YouTube upload** (`src/renderer/components/export/YouTubeUpload.tsx`)
   - OAuth 2.0 flow for Google account authorization
   - YouTube Data API v3: `videos.insert()` for upload
   - Auto-fill from script: title (first section), description (script summary), tags (key topics)
   - User can edit title, description, tags, privacy, category before upload
   - Upload progress bar
   - Post-upload: show YouTube URL

9.3. **DaVinci Resolve export via FCPXML** (`src/renderer/components/export/DaVinciExport.tsx`)
   - Generate **FCPXML** (Final Cut Pro XML) project file — fully documented format by Apple
   - DaVinci Resolve 18+ can import FCPXML natively
   - Map Leonardo timeline → FCPXML structure:
     - Tracks → FCPXML `<spine>` and `<lane>` elements
     - Clips → FCPXML `<asset-clip>` with media references
     - Effects (freeze, zoom) → FCPXML `<adjust-transform>` and freeze-frame markers
     - Audio → FCPXML audio lanes
   - Export linked media (recording, clips, audio) alongside FCPXML file in a directory structure
   - **Stretch goal**: native `.drp` export (proprietary, undocumented — only if FCPXML proves insufficient)

9.4. **Export settings persistence**
   - Save export presets (e.g., "YouTube 1080p", "ProRes Master", "DaVinci Edit")
   - Default preset per project

**Acceptance Criteria:**
- [ ] File export produces valid H.264, H.265, and ProRes files
- [ ] YouTube upload via OAuth works end-to-end
- [ ] Auto-populated YouTube metadata (title, description, tags) comes from script
- [ ] FCPXML file imports into DaVinci Resolve 18+ with editable timeline and linked media (spec deviation: .drp is proprietary/undocumented; FCPXML is the documented equivalent that DaVinci imports natively)
- [ ] Exported DaVinci project includes all media (recording, clips, audio)
- [ ] Export presets can be saved and reused
- [ ] Upload/export progress is shown to user

**Tests:**
- Unit: FCPXML generation, YouTube metadata extraction from script
- Integration: YouTube API upload (real API with test account), FFmpeg codec encoding (real FFmpeg)
- E2E: Full export flow for each target (file, YouTube, DaVinci)

---

### Phase 10: Input Modes 2, 3, 4

**Goal:** Implement the remaining three input modes beyond Mode 1 (which is covered by Phases 2-9).

**Steps:**

10.1. **Mode 2: Prompt First, Record After**
   - User writes prompt/description first
   - AI generates a draft script with step-by-step instructions
   - Script displayed as a guided checklist during recording
   - User records while following the checklist
   - System matches recording segments to script steps
   - Post-recording: AI refines script based on actual recording duration/events

10.2. **Mode 3: Simultaneous (Real-Time Annotations)**
   - During recording, show an annotation input field (text input always available)
   - User types annotations while performing actions (primary input method, works offline)
   - Annotations timestamped and linked to recording
   - **Voice annotations (stretch goal)**: use browser SpeechRecognition API for transcription. NOTE: SpeechRecognition requires online connectivity (Chrome's cloud service), which conflicts with Principle 5 (Local-First). Text annotation is the primary offline-safe method; voice annotation is best-effort when online.
   - Post-recording: AI polishes annotations into coherent narration script

10.3. **Mode 4: Fully Automatic (Browser Automation)**
   - User provides: target URL + text prompt describing the tutorial
   - AI generates a Playwright script from the prompt
   - Playwright runs in Electron's embedded browser:
     - Navigate to URL
     - Execute steps (click, type, navigate)
     - Capture DOM events + screen recording simultaneously
   - AI reviews recording + events and generates narration script
   - Safety: sandboxed execution, user can cancel, no login credential storage

10.4. **Input mode abstraction**
   - Each mode implements an `IInputMode` interface:
     - `start(): Promise<void>` — begin acquisition
     - `getRecording(): Recording` — return screen recording
     - `getScript(): Script` — return generated script
     - `getDOMEvents(): DOMEvent[]` — return captured events
   - Project wizard selects mode; pipeline receives uniform output

**Acceptance Criteria:**
- [ ] Mode 2: User writes prompt, sees guided checklist during recording, AI refines post-recording
- [ ] Mode 3: User can annotate via text input during recording, annotations are timestamped, AI polishes into script
- [ ] Mode 3 (stretch): Voice annotation transcription works when online (SpeechRecognition API); text annotation always works offline
- [ ] Mode 4: User provides URL + prompt, system auto-records browser session via Playwright
- [ ] All 4 modes produce identical artifacts (Recording + Script + DOMEvents)
- [ ] Pipeline processes all modes identically after acquisition

**Tests:**
- Unit: Input mode interface compliance, Playwright script generation
- Integration: Playwright automation (real browser), speech recognition (real API)
- E2E: Complete flow for each input mode → verify output quality

---

### Phase 11: Polish & Integration

**Goal:** Cross-platform testing, performance optimization, packaging, final QA.

**Steps:**

11.1. **Cross-platform testing**
   - Test on macOS (Intel + Apple Silicon), Windows 10/11, Ubuntu 22.04+
   - Verify FFmpeg binary bundling per platform
   - Verify Piper TTS binary bundling per platform
   - Fix platform-specific issues (paths, permissions, media codecs)

11.2. **Performance optimization**
   - Profile render times: target < 2x realtime for standard hardware
   - Optimize thumbnail generation (batch extraction)
   - Lazy load timeline components for long recordings
   - Memory management: release video buffers when not in view

11.3. **Packaging and distribution**
   - `electron-builder` configuration for dmg (macOS), exe/NSIS (Windows), AppImage (Linux)
   - Code signing for macOS and Windows
   - Auto-updater (electron-updater)
   - FFmpeg and Piper binaries bundled per platform

11.4. **Final QA pass**
   - Full end-to-end test for each input mode × each export target
   - Accessibility audit (keyboard navigation, screen reader basics)
   - Memory leak testing for long sessions
   - Error handling: graceful failures for network issues, missing binaries, disk full

**Acceptance Criteria:**
- [ ] App installs and runs on macOS, Windows, Linux
- [ ] Render time < 2x realtime for 10-minute tutorial on standard hardware
- [ ] No memory leaks in 2-hour editing session
- [ ] All 4 input modes × 3 export targets work end-to-end
- [ ] Graceful error handling for common failure modes

---

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| FFmpeg command complexity for effects | Rendering bugs, visual artifacts | High | Build a composable FFmpeg command builder with unit tests for each effect type. Use filtergraph abstraction. |
| Electron BrowserView recording quality | Choppy video, sync drift | Medium | Fall back to desktopCapturer if BrowserView capture has issues. Test early in Phase 2. |
| DaVinci Resolve export format | Incompatible project files | Medium (mitigated) | Use FCPXML (documented, DaVinci imports it natively). Native .drp is stretch goal only. |
| Piper TTS quality on non-English languages | Unusable audio for non-English tutorials | Medium | Start English-only. Document language support matrix. ElevenLabs covers multi-language for production tier. |
| Electron app size (Chromium + FFmpeg + Piper + Playwright) | 500MB+ download | High | Lazy-download optional binaries (Playwright only needed for Mode 4). Use FFmpeg-static for minimal binary. Target < 300MB base. |
| DOM event capture breaks on complex SPAs | Missing or incorrect sync points | Medium | Test against popular frameworks (React, Vue, Angular). Add manual sync point creation as fallback. |
| YouTube API rate limits | Upload failures during batch export | Low | Implement retry with exponential backoff. Show clear error messages. |
| Cross-project drag & drop in Electron | Complex multi-window IPC | Medium | Implement cross-project sharing via clipboard/temp file initially, add true DnD in later iteration. |
| Electron not suited for real-time NLE compositing | User expects DaVinci-like playback | High | Explicitly scope as "NLE-style editing workflow with render-to-preview." Build fast scrub-preview (thumbnail strips + cached short-segment renders). |
| Worker crashes during long operations | Lost progress on render/TTS/AI | Medium | Worker crash recovery protocol (Phase 1): heartbeat, auto-restart, checkpoint files, per-stage resume. |
| App crash loses editing work | User loses unsaved changes | Medium | Auto-save every 30s (Phase 1), dirty shutdown detection, restore offer on restart. |
| Memory pressure with 4K recordings | App slowdowns or crashes on large projects | Medium | Timeline virtualization for long recordings, thumbnail cache limits, explicit temp file cleanup. Design in Phase 1, implement in Phase 6+. |
| SpeechRecognition API requires online connectivity | Mode 3 voice annotations fail offline | Low | Text annotation is primary/offline method. Voice annotation is stretch goal, best-effort when online. Documented as Local-First exception. |

## Verification Steps

1. **Phase Gate Reviews**: After each phase, run the full test suite and verify acceptance criteria before proceeding.
2. **Integration Smoke Test** (after Phase 5): Complete Mode 1 flow end-to-end (record → script → sync → preview).
3. **Render Quality Review** (after Phase 8): Visual inspection of 5 rendered tutorials against "YouTube tutorial quality" standard.
4. **Cross-Platform Verification** (Phase 11): Full test suite on macOS, Windows, Linux.
5. **Performance Benchmark** (Phase 11): Measure render time for 2-min, 10-min, 30-min, 60-min tutorials.
6. **Export Verification**: Open exported .drp in DaVinci Resolve. Upload to YouTube test channel. Verify H.264/H.265/ProRes playback in VLC.

---

## ADR: Architecture Decision Record

### Decision
Use **Electron + Worker Architecture** (Option C) with React UI, dedicated child processes for recording/AI/TTS/rendering, SQLite for persistence, and FFmpeg for video processing.

### Drivers
1. **UI responsiveness** — NLE-style apps must never freeze during heavy operations
2. **Single deployment** — Local desktop app must be a single installable artifact
3. **Cross-platform** — Must work on macOS, Windows, Linux with identical behavior

### Alternatives Considered
- **Monolithic Electron** (Option A): Rejected due to UI blocking risk during rendering/AI calls
- **Electron + Backend Server** (Option B): Rejected due to deployment complexity and "no server" constraint

### Why Chosen
Option C provides UI isolation (workers handle heavy tasks), single-artifact deployment (no separate server), and natural parallelism (render while editing). This is the industry-standard pattern for Electron apps with heavy processing (VS Code, Figma desktop use similar patterns).

### Consequences
- Must implement IPC protocol between main process and workers (typed messages, error semantics)
- Worker crash recovery protocol designed in Phase 1 (heartbeat, auto-restart, checkpoint files)
- Large data (video frames) requires efficient serialization between processes — use file paths, not in-memory buffers
- Testing requires worker mocking for unit tests, real workers for integration tests
- NLE-style UI is scoped to editing workflow, NOT real-time video compositing — managed via thumbnail-strip scrub preview
- Undo/redo integrated from Phase 1 via `zundo` middleware on Zustand stores

### Follow-ups
- Evaluate `electron-vite` vs. custom build configuration in Phase 1
- Benchmark `worker_threads` vs. `child_process` for AI and TTS workers
- Investigate SharedArrayBuffer for zero-copy video frame sharing between processes
- Validate FCPXML import in DaVinci Resolve 18+ early in Phase 9
- Spike Playwright-in-Electron feasibility in Phase 2 (2-hour timebox)
- Test GPU-accelerated encoding (VideoToolbox, NVENC, VAAPI) in Phase 2.5 rendering spike

---

## Spec Deviations

| Spec Requirement | Plan Deviation | Rationale |
|-----------------|----------------|-----------|
| Export to DaVinci Resolve `.drp` project file | Export via FCPXML (documented format); `.drp` is stretch goal | `.drp` is proprietary and undocumented. FCPXML is Apple-documented and DaVinci Resolve 18+ imports it natively. Same user outcome, much lower risk. |
| Mode 3: "text or voice annotations" | Voice annotation is stretch goal; text is primary | Browser SpeechRecognition API requires online connectivity, conflicting with Local-First principle. Text annotation works offline and covers the core use case. |

## Changelog
- v1.0: Initial plan from Planner based on deep-interview spec (12% ambiguity, 16 rounds)
- v2.0: Revised per Architect review — incorporated all 10 revision items:
  1. Added Phase 2.5 (Rendering Spike) to validate FFmpeg composition before dependent phases
  2. Added undo/redo architecture (zundo middleware) to Phase 1
  3. Moved IInputMode interface definition from Phase 10 to Phase 1
  4. Defined worker crash recovery protocol (heartbeat, auto-restart, checkpoints) in Phase 1
  5. Replaced .drp with FCPXML as primary DaVinci Resolve export format
  6. Added NLE-style scope clarification (editing workflow, not real-time compositing)
  7. Added auto-save architecture (30s interval, crash recovery) to Phase 1
  8. Added Playwright-in-Electron feasibility spike to Phase 2
  9. Added .leonardo project file format (zip archive) to Phase 1
  10. Added GPU-accelerated encoding testing to Phase 2.5
  11. Refined IAIProvider with separate refineSyncPoints method
  12. Fixed ITTSProvider return type (file path, not AudioBuffer)
  13. Added ExportResult type definition
- v2.1: Fixed per Critic review — 2 MAJOR items resolved:
  1. Fixed FCPXML vs .drp wording in Phase 9 acceptance criteria (now explicitly says FCPXML)
  2. Scoped Mode 3 voice annotations as stretch goal, added acceptance criterion for text + voice, added SpeechRecognition risk
  3. Added Spec Deviations section documenting deliberate departures from spec
  4. Fixed "DaVinci XML generation" test reference to "FCPXML generation"
