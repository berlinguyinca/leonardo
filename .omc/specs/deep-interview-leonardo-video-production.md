# Deep Interview Spec: Leonardo — AI-Powered Video Tutorial Production System

## Metadata
- Interview ID: leonardo-vps-2026-04-09
- Rounds: 16
- Final Ambiguity Score: 12%
- Type: greenfield
- Generated: 2026-04-09
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.92 | 0.40 | 0.368 |
| Constraint Clarity | 0.87 | 0.30 | 0.261 |
| Success Criteria | 0.85 | 0.30 | 0.255 |
| **Total Clarity** | | | **0.88** |
| **Ambiguity** | | | **12%** |

## Goal

Build **Leonardo**, a cross-platform Electron desktop application for automatically generating polished video tutorials of web applications. The system provides a single rendering pipeline with four input modes for acquiring screen recordings and narration scripts. It produces professional-quality video output (comparable to YouTube tutorial standards) with AI-generated scripts, text-to-speech narration, and automatic synchronization — all coordinated through an NLE-style UI inspired by DaVinci Resolve and Adobe Premiere.

### Core Pipeline

```
Input Mode → Screen Recording + DOM Events → AI Script Generation → TTS Audio → 
Sync Timeline (auto-generated + user review) → Rendering (with effects) → Export

Additionally: Clip Library + Multi-Track Composition + Script Editing + Voice Assignment
```

### Four Input Modes

All input modes produce the same artifacts (recording + script + sync timeline) and feed into the same rendering pipeline. They differ only in HOW the recording and script are acquired:

1. **Record First, Prompt After** — User manually records screen interactions in the embedded browser (e.g., logging into a website), stops recording, then writes a prompt describing what they did. AI generates a narration script from the prompt + recording metadata.

2. **Prompt First, Record After** — User writes a prompt/script first (e.g., "Show how to log in to example.com"), then the tool guides them through recording the screen session to match the script.

3. **Simultaneous** — User records and annotates intent in real-time (text or voice annotations during recording). AI polishes annotations into a final narration script.

4. **Fully Automatic** — User provides a URL + prompt (e.g., "Show login flow on example.com"). The tool uses browser automation (Playwright/Puppeteer in Electron) to perform AND record the actions automatically — no manual interaction.

### Clip Library & Multi-Track Composition

The timeline supports multiple video tracks for compositing screen recordings with imported media:

- **Clip Library**: Persistent library of reusable assets (intros, outros, B-roll, transitions, custom clips) that persists across projects. Assets can be imported from files, other Leonardo projects, or external sources.
- **Multi-Track Timeline**: Screen recording, imported clips, picture-in-picture overlays, and B-roll on separate tracks. Full multi-track composition like a simplified NLE.
- **Drag & Drop**: Full drag & drop support including:
  - Within-app: drag clips from library to timeline, reorder segments, move/resize sync points, drag assets between tracks
  - External: drag files from Finder/Explorer directly into the app (auto-imports to library/timeline)
  - Cross-project: drag assets between open projects (multi-tab/window support)

### Script Editing & Voice Assignment

After AI generates a script, users can edit and assign voices through three editing views:

1. **Script-Only View**: Full-text editor for bulk script editing — edit paragraphs, restructure narration, assign voices per section via dropdown
2. **Dual-Pane View**: Left: script editor (paragraph-level). Right: timeline (sync points, tracks). Clicking a paragraph highlights the corresponding timeline segment and vice versa. Synced editing.
3. **Inline Timeline Editing**: Edit narration text directly on timeline segments. Click a segment, modify text, pick voice from dropdown. Quick fixes without leaving the timeline.

Voice assignment is available in all views. Script changes re-trigger TTS only for affected sections (incremental re-generation, not full re-render).

### Configurable Recording Resolution

Recording resolution (1080p, 1440p, 4K) is configurable independently of the user's screen size. The embedded browser viewport matches the target output resolution for pixel-perfect recordings.

## Constraints

- **Platform**: Cross-platform — macOS, Windows, Linux (via Electron)
- **Runtime**: Runs locally as a desktop application; no server required
- **AI Backend**: Hybrid — supports cloud APIs (Claude, Codex/OpenAI) AND local models via Ollama. Hardware-adaptive: uses cloud APIs on lightweight machines, local models on powerful ones
- **TTS — Free Tier**: Local TTS engine (Piper or Coqui TTS) — runs offline, zero API costs, acceptable quality for prototyping/drafts
- **TTS — Production Tier**: ElevenLabs API for voice cloning — user uploads voice samples to create custom voices for professional output
- **Recording Technology**: Electron app with embedded browser (Chromium). Can capture DOM events (clicks, form submissions, page navigation, input focus) alongside video for intelligent sync
- **UI Paradigm**: NLE-style interface inspired by DaVinci Resolve / Adobe Premiere — professional video editing workflow with timeline, panels, and workspace layout
- **Export Codecs**: H.264, H.265 (HEVC), Apple ProRes (must-have for prototype)
- **YouTube Integration**: Direct upload via YouTube Data API v3 with OAuth — auto-fills title, description, and tags from AI-generated script metadata
- **DaVinci Resolve Integration**: Export as `.drp` DaVinci Resolve project file with editable timeline and linked media assets
- **Video Processing**: Must handle rendering, freeze frames, zoom effects, transitions, and intros/outros locally using FFmpeg or similar
- **Video Length**: No enforced limit — system adapts with background processing and progress tracking for long recordings
- **Intro/Outro System**: Template-based layouts (title card intro, CTA outro) with AI-generated text content from the script; user can adjust in the timeline editor before rendering
- **Recording Resolution**: Configurable output resolution (1080p, 1440p, 4K) — embedded browser viewport matches target resolution independent of user's screen
- **Clip Library**: Persistent asset library across projects with drag & drop import from OS file manager
- **Multi-Track Timeline**: Multiple video/audio tracks for compositing screen recordings, imported clips, overlays, and B-roll
- **Drag & Drop**: Within-app (library to timeline, reorder, resize), external file import (OS file manager), and cross-project asset sharing
- **Script Editing**: Three editing views (script-only, dual-pane synced, inline timeline) with per-section voice assignment
- **Incremental TTS**: Script edits only re-generate audio for changed sections, not the entire narration

## Non-Goals

- **Not a general video editor** — this is specifically for tutorial production, not general-purpose NLE
- **Not a streaming tool** — no live streaming support; output is pre-rendered video
- **Not a SaaS** — runs locally, no cloud infrastructure for the app itself (cloud APIs for AI/TTS are optional external services)
- **Not a Google Stitch project** — UI is built conventionally within Electron, not generated by Stitch
- **No mobile support** — desktop only (macOS, Windows, Linux)

## Acceptance Criteria

- [ ] User can select any of the 4 input modes from a project creation wizard
- [ ] **Input Mode 1 (Record First)**: User records browser interaction, stops, writes prompt, and receives an AI-generated narration script within 30 seconds for a 2-minute recording
- [ ] **Input Mode 2 (Prompt First)**: User writes a prompt, system provides guided recording flow, and script is pre-generated before recording
- [ ] **Input Mode 3 (Simultaneous)**: User can annotate during recording, and annotations are polished into a coherent script by AI
- [ ] **Input Mode 4 (Fully Automatic)**: User provides URL + prompt, and the system records an automated browser session without manual intervention
- [ ] AI script generation works with at least 2 backends: one cloud API (Claude or OpenAI) and one local (Ollama)
- [ ] User can switch between AI backends in settings without affecting project data
- [ ] Free TTS (Piper/Coqui) produces listenable narration from generated scripts
- [ ] ElevenLabs voice cloning produces professional-quality narration from user-uploaded voice samples
- [ ] System auto-generates a sync timeline from DOM events (clicks, form fills, navigation) + AI script analysis
- [ ] Sync timeline is displayed in an NLE-style timeline editor where users can review and adjust sync points before rendering
- [ ] Freeze frames are automatically inserted at sync points with configurable duration
- [ ] Zoom-in effects automatically target relevant UI areas based on DOM event coordinates
- [ ] Intro uses template layout with AI-generated text (tutorial title, key topics) from the script
- [ ] Outro uses template layout with AI-generated summary and call-to-action from the script
- [ ] Users can customize intro/outro templates (branding, colors, text) and adjust in timeline editor
- [ ] Final render produces polished tutorial-quality video (intro, smooth transitions, annotated freeze frames, zoom-ins, outro)
- [ ] Export to H.264 MP4 works on all platforms
- [ ] Export to H.265 and ProRes works
- [ ] Direct YouTube upload via API with auto-populated title, description, and tags from script
- [ ] Export to DaVinci Resolve `.drp` project file with editable timeline and linked media
- [ ] Application runs on macOS, Windows, and Linux
- [ ] All AI processing (script generation, sync analysis) works in both online (cloud API) and offline (Ollama) modes
- [ ] Long recordings (60+ minutes) render via background processing with progress tracking
- [ ] No artificial video length limit — system handles any duration the user records
- [ ] Persistent clip library stores reusable assets across projects
- [ ] Users can import external video/audio/image files into the clip library
- [ ] Multi-track timeline supports at least: screen recording track, imported clip track, audio/narration track, and overlay track
- [ ] Drag & drop works within the app (library to timeline, reorder segments)
- [ ] Drag & drop accepts files from OS file manager (Finder/Explorer) and auto-imports them
- [ ] Assets can be dragged between open projects
- [ ] AI-generated script is editable in script-only view (full-text editor)
- [ ] Dual-pane view syncs script editor with timeline (click paragraph highlights segment and vice versa)
- [ ] Inline timeline editing allows text and voice changes directly on timeline segments
- [ ] Different voices can be assigned to different script sections (per-paragraph voice assignment)
- [ ] Script edits trigger incremental TTS re-generation (only changed sections, not full re-render)
- [ ] Recording resolution is configurable (1080p, 1440p, 4K) independent of user's screen size
- [ ] Embedded browser viewport matches the selected target resolution for pixel-perfect output

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Google Stitch would generate the UI | Asked what role Stitch plays vs. Electron | Dropped Stitch entirely — UI built conventionally in Electron, styled like DaVinci Resolve / Premiere |
| Auto-sync must be fully automatic | Challenged whether perfect auto-sync is realistic | Hybrid: auto-generate sync timeline + user review in timeline editor before render |
| 4 workflows are 4 separate products | Ontologist question: "What IS the core entity?" | One pipeline, 4 input modes — Project is the core entity, not Workflow |
| Each workflow needs its own pipeline | Asked if workflows produce different artifacts | All workflows produce the same artifacts (recording + script + timeline) and share one rendering pipeline |
| TTS needs to be cloud-only for quality | Asked about specific TTS providers and tiers | Two-tier: local Piper/Coqui for free prototyping, ElevenLabs cloud for production voice cloning |
| Recording requires OS-level screen capture | Asked about recording technology tradeoffs | Electron with embedded browser — captures DOM events for better sync, cross-platform via Electron |
| Scale requirement for concurrent users | N/A — this is a local desktop app | Single-user local application, no concurrency concerns |
| Intros/outros need manual creation | Asked whether templates, AI-generated, or both | Templates + AI content: template layouts with AI-generated text from script, user-adjustable |
| Video length should have limits | Asked about expected tutorial scale | No limits — system adapts with background processing for long videos |
| Only screen recordings as video source | Asked about integrating existing clips | Clip library + multi-track: persistent library, multi-track timeline, full drag & drop including cross-project |
| Script is read-only after AI generation | Asked about editing and voice assignment | Three editing views (script-only, dual-pane, inline), per-section voice assignment, incremental TTS re-gen |
| "Maximizing recording space" means hiding UI | Asked what this phrase means | Configurable resolution: set recording resolution independent of screen size, browser viewport matches target |
| Drag & drop is within-app only | Asked about scope of drag & drop | Full scope: within-app, external files from OS, and cross-project asset sharing |

## Technical Context

### Technology Stack
- **Desktop Shell**: Electron (cross-platform)
- **Embedded Browser**: Chromium (via Electron's BrowserView/webContents)
- **Frontend Framework**: React or Vue with NLE-style component library (timeline, panels, workspace)
- **AI Backends**: Claude API, OpenAI/Codex API, Ollama (local) — abstracted behind a common interface
- **TTS Free Tier**: Piper or Coqui TTS (local, offline)
- **TTS Production**: ElevenLabs API (voice cloning)
- **Video Processing**: FFmpeg (rendering, codec encoding, freeze frames, transitions)
- **Browser Automation** (Mode 4): Playwright or Puppeteer running inside Electron
- **DOM Event Capture**: Injected content scripts in embedded browser to capture user interactions
- **Export**: YouTube Data API v3, DaVinci Resolve project file format (.drp), FFmpeg for codec encoding

### Key Architectural Decisions
1. **One pipeline, four input modes** — reduces complexity and duplication
2. **Hybrid AI** — cloud + local via abstraction layer — users bring their own API keys or use local Ollama
3. **DOM event-based sync** — embedded browser advantage over OS-level capture
4. **Auto-generate + review** sync model — balances automation with user control
5. **Two-tier TTS** — free local for iteration speed, cloud for production quality
6. **NLE-style UI** — professional workflow familiar to video producers
7. **Multi-track composition** — screen recording + imported clips + overlays on separate tracks
8. **Persistent clip library** — reusable assets across projects with drag & drop from OS
9. **Three-view script editing** — script-only, dual-pane synced, inline timeline for different editing tasks
10. **Per-section voice assignment** — different voices for different script sections with incremental TTS
11. **Configurable recording resolution** — pixel-perfect output independent of user's screen

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Project | core domain | name, input_mode, status, created_at, export_config | Has one Recording, one Script, one Sync Timeline, one Clip Library reference, many Exports |
| Video Tutorial | core domain | duration, resolution, codec, quality_tier | Produced by one Project via Rendering Pipeline |
| Screen Recording | core domain | video_file, dom_events[], duration, url, resolution | Belongs to one Project, captured via Embedded Browser |
| Script | core domain | text, timing_markers[], ai_backend_used, prompt, sections[], editable | Belongs to one Project, generated by AI Backend, editable in 3 views, has Voice Assignments per section |
| Input Mode | core domain | type (record-first, prompt-first, simultaneous, fully-automatic) | Used by Project to determine acquisition flow |
| Rendering Pipeline | core domain | input_recording, input_script, input_timeline, output_video | Processes one Project into one Video Tutorial |
| Sync Timeline | core domain | sync_points[], tracks[], duration, reviewed (bool) | Belongs to one Project, displayed in Timeline Editor, supports multiple video/audio tracks |
| Sync Point | core domain | timestamp, type (freeze/zoom/annotation), source (dom/script/manual), duration, coordinates | Belongs to one Sync Timeline |
| Timeline Editor | supporting | tracks[], zoom_level, playhead_position | Displays and edits one Sync Timeline |
| AI Backend | external system | provider (claude, openai, ollama), mode (cloud, local), api_key | Generates Scripts |
| TTS Processor | external system | engine (piper, coqui, elevenlabs), voice_profile, quality_tier | Converts Script to audio |
| Voice Profile | core domain | name, samples[], provider, voice_id | Used by TTS Processor for voice cloning |
| Intro/Outro | supporting | template, title_text, branding, duration, ai_generated_content | Attached to Project, uses template layout + AI-generated text from Script, user-adjustable in Timeline Editor |
| Export Target | supporting | type (file, youtube, davinci), codec, resolution, settings | Configured per Project |
| Freeze Frame | supporting | source_frame, duration, annotation_text, position | Inserted at Sync Point during render |
| Zoom-in Effect | supporting | target_coordinates, zoom_level, duration, easing | Applied at Sync Point during render |
| Transition | supporting | type (fade, cut, dissolve), duration | Applied between sections during render |
| Embedded Browser | core domain | url, user_agent, viewport_size, dom_event_injection | Used for recording, part of Electron app |
| DOM Event Capture | supporting | event_type (click, submit, navigate, focus), timestamp, element_selector, coordinates | Captured during recording, used to generate Sync Points |
| Platform Runtime | supporting | os, electron_version, ffmpeg_path, gpu_available | Runtime environment for the app |
| NLE-Style UI | supporting | layout (panels, timeline, preview), theme, workspace_preset | Application shell inspired by DaVinci Resolve / Premiere |
| Clip Library | core domain | clips[], tags[], persistent (bool), import_sources | Shared across Projects, stores reusable assets (intros, B-roll, transitions) |
| Media Clip | core domain | file_path, type (video/audio/image), duration, thumbnail, source | Belongs to Clip Library, can be placed on any Video Track |
| Video Track | core domain | type (recording/clip/overlay/audio), segments[], z_order | Belongs to Sync Timeline, holds ordered segments for multi-track composition |
| Script Editor | supporting | mode (script-only/dual-pane/inline), active_section, voice_assignment_ui | Provides 3 editing views for Script, syncs with Timeline Editor in dual-pane mode |
| Voice Assignment | core domain | section_id, voice_profile_id, tts_engine | Maps Script sections to Voice Profiles, triggers incremental TTS re-generation |
| Recording Resolution | supporting | width, height, preset (1080p/1440p/4K), match_viewport (bool) | Configured per Project, embedded browser viewport matches target |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 9 | 9 | - | - | N/A |
| 2 | 12 | 3 | 0 | 9 | 75% |
| 3 | 13 | 1 | 0 | 12 | 92% |
| 4 | 15 | 2 | 0 | 13 | 87% |
| 5 | 16 | 1 | 0 | 15 | 94% |
| 6 | 17 | 1 | 0 | 16 | 94% |
| 7 | 19 | 2 | 0 | 17 | 89% |
| 8 | 20 | 1 | 0 | 19 | 95% |
| 9 | 21 | 2 | 1 | 18 | 90% |
| 10 | 21 | 0 | 0 | 21 | 100% |

| 11 | 21 | 0 | 0 | 21 | 100% |
| 12 | 21 | 0 | 0 | 21 | 100% |
| 13 | 24 | 3 | 0 | 21 | 88% |
| 14 | 26 | 2 | 0 | 24 | 92% |
| 15 | 26 | 0 | 0 | 26 | 100% |
| 16 | 27 | 1 | 0 | 26 | 96% |

Ontology reached initial convergence at Round 10. Scope expansion in Round 13 introduced clip library, multi-track, and media entities. Re-converged at Round 15 (100%), with one final entity (Recording Resolution) added in Round 16.

## Interview Transcript

<details>
<summary>Full Q&A (16 rounds)</summary>

### Round 1
**Q:** Walk me through the exact workflow from the user's perspective: You open the tool, then what? Specifically — do you (1) start a screen recording session in a browser, perform actions, stop recording, THEN write a prompt describing what you did? Or (2) write the prompt first and the tool records automatically? Or something else entirely?
**A:** We want different workflows, 1, 2, 3, 4 each as its own workflow coordinated from a main wizard or entry page.
**Ambiguity:** 72% (Goal: 0.45, Constraints: 0.25, Criteria: 0.10)

### Round 2
**Q:** Imagine the MVP is done and you're demoing it. You pick Workflow 1 (record first, prompt after), record yourself logging into a site, write a prompt, and hit 'Generate'. What does the final output video look like that makes you say 'yes, this works'?
**A:** Polished tutorial style — looks like a professional tutorial: intro slide, recording with zoom-ins on relevant UI areas, freeze frames with annotations, smooth transitions, outro with call-to-action.
**Ambiguity:** 61% (Goal: 0.50, Constraints: 0.25, Criteria: 0.40)

### Round 3
**Q:** You said this runs locally. What does 'locally' mean in practice? (a) What OS? (b) Cloud vs. local AI? (c) Target machine spec?
**A:** Cross-platform, hybrid AI — all major OSes, both cloud APIs and local Ollama models, hardware-adaptive.
**Ambiguity:** 55% (Goal: 0.50, Constraints: 0.45, Criteria: 0.40)

### Round 4 (Contrarian Mode)
**Q:** You said synchronization and freeze frames should happen 'automatically'. What if perfect auto-sync isn't actually necessary?
**A:** Auto-generate + user review — system generates sync timeline with proposed freeze frames and zoom points, user reviews and adjusts in a timeline editor before final render.
**Ambiguity:** 48% (Goal: 0.55, Constraints: 0.45, Criteria: 0.55)

### Round 5
**Q:** How should the screen recording actually work technically? Browser extension, Electron, OS-level, or hybrid?
**A:** Electron app with embedded browser — desktop app with built-in browser view, full control over recording environment, cross-platform.
**Ambiguity:** 44% (Goal: 0.55, Constraints: 0.60, Criteria: 0.55)

### Round 6 (Simplifier Mode)
**Q:** You mentioned Google Stitch for the frontend AND chose Electron. These pull in different directions. What's the simplest version? What role does Stitch actually play?
**A:** We don't need Stitch, it was just an idea to get very pretty apps. We want to look like DaVinci Resolve or Adobe Premiere workflow-wise.
**Ambiguity:** 40% (Goal: 0.65, Constraints: 0.60, Criteria: 0.55)

### Round 7
**Q:** What events should trigger sync points (freeze frames, zoom-ins, annotations) in the auto-generated timeline?
**A:** Hybrid: events + script — DOM events create candidate sync points, AI script selects which to keep, adjusts timing, and adds additional emphasis points.
**Ambiguity:** 35% (Goal: 0.65, Constraints: 0.60, Criteria: 0.70)

### Round 8
**Q:** You mentioned two TTS tiers. What specific engines? How does voice cloning work?
**A:** Local free + ElevenLabs clone — free tier uses local Piper/Coqui TTS, production uses ElevenLabs API. User uploads voice samples to create custom voices.
**Ambiguity:** 31% (Goal: 0.65, Constraints: 0.72, Criteria: 0.70)

### Round 9 (Ontologist Mode)
**Q:** Are the 4 workflows truly independent products, or variations of one core pipeline? Is "Workflow" the core entity, or is it "Project"?
**A:** Yes — one pipeline, 4 input modes. All workflows produce the same artifacts. Project is the core entity.
**Ambiguity:** 25% (Goal: 0.80, Constraints: 0.72, Criteria: 0.70)

### Round 10
**Q:** For the export pipeline: YouTube API integration level? DaVinci Resolve format? Required codecs?
**A:** YouTube API + DaVinci project file — full integration: direct YouTube upload via OAuth with auto-filled metadata, DaVinci .drp export with editable timeline, codecs H.264/H.265/ProRes.
**Ambiguity:** 20% (Goal: 0.80, Constraints: 0.80, Criteria: 0.80)

### Round 11
**Q:** You said the rendered video needs intros and outros. What should these actually consist of? Templates, AI-generated, or both?
**A:** Templates + AI content — template-based layout (title card intro, CTA outro) with AI-generated text content from script. User adjusts in editor.
**Ambiguity:** 15% (Goal: 0.88, Constraints: 0.80, Criteria: 0.85)

### Round 12
**Q:** What's the expected scale of individual tutorials? Should the tool enforce any maximum video length?
**A:** No limit, user decides — system adapts with background processing and progress tracking for long videos.
**Ambiguity:** 13% (Goal: 0.88, Constraints: 0.87, Criteria: 0.85)

### Round 13
**Q:** You mentioned integrating existing video clips and a clip library. What's the use case?
**A:** Clip library + multi-track — persistent clip library AND multi-track timeline for compositing screen recording + clips + overlays. Most powerful option.
**Ambiguity:** 23% (Goal: 0.75, Constraints: 0.85, Criteria: 0.72) — scope expanded

### Round 14
**Q:** What does script editing and voice assignment look like? Text editor, dual-pane, or inline?
**A:** All three views available — script-only for bulk editing, dual-pane for sync work, inline for quick fixes. Voice assignment in all views.
**Ambiguity:** 18% (Goal: 0.82, Constraints: 0.85, Criteria: 0.80)

### Round 15
**Q:** What do you mean by "maximizing recording space"?
**A:** Configurable resolution — set recording resolution (1080p, 1440p, 4K) independent of screen size, embedded browser viewport matches target.
**Ambiguity:** 14% (Goal: 0.88, Constraints: 0.87, Criteria: 0.82)

### Round 16
**Q:** For drag & drop: standard NLE, external file import, or cross-project?
**A:** NLE + external + cross-project — full scope: within-app, external files from OS, and cross-project asset sharing.
**Ambiguity:** 12% (Goal: 0.92, Constraints: 0.87, Criteria: 0.85)

</details>
