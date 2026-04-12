# Deep Interview Spec: Recording System Overhaul

## Metadata
- Rounds: 7
- Final Ambiguity Score: 7%
- Type: brownfield
- Generated: 2026-04-11
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 35% | 0.32 |
| Constraint Clarity | 0.70 | 25% | 0.18 |
| Success Criteria | 0.85 | 25% | 0.21 |
| Context Clarity | 0.75 | 15% | 0.11 |
| **Total Clarity** | | | **0.82** |
| **Ambiguity** | | | **18%** |

## Goal

Replace the broken `getDisplayMedia` + `desktopCapturer` screen recording pipeline with a reliable `webContents.capturePage()` → FFmpeg frame-pipe approach. Capture **only the webview content** (website being browsed, no app UI chrome). Simultaneously enhance DOM event capture to collect full element snapshots (semantic HTML, computed styles, bounding rects, parent chain) for each interaction, feeding the AI script generator with rich metadata.

## Constraints

- Capture at 15+ fps for smooth playback
- Output format: MP4 (H.264) — no intermediate WebM step
- Capture only the webview content (not the full Leonardo window)
- Must work in Electron's sandboxed renderer (`sandbox: true`, `contextIsolation: true`)
- No system screen recording permissions required (capturePage is internal to Electron)
- Frame resolution matches the webview's target resolution (1920x1080 default)
- DOM metadata must include: tagName, id, className, innerText, alt, title, aria-label, aria-describedby, href, type, name, placeholder, role, computed styles (color, fontSize, position), bounding rect, parent chain (ancestor tags), sibling context

## Non-Goals

- Recording audio (microphone or system audio) — out of scope for now
- Recording the full Leonardo app window or desktop
- Real-time video preview during recording (the webview itself IS the preview)
- Headless/Playwright-based recording

## Phased Delivery

### Phase 1 (ship first): Working Video + Semantic Metadata
- Fix the video capture pipeline — get reliable continuous recording
- Enhance DOM events with semantic HTML fields

### Phase 2 (follow-up): Rich Metadata + Page Context
- Add computed styles, bounding rects, parent chain, sibling context
- Add page-structure snapshots on navigation (title, meta, headings, landmarks)

## Acceptance Criteria — Phase 1

- [ ] Recording produces a smooth MP4 video (15+ fps) showing website interactions
- [ ] Video contains ONLY the webview content, no Leonardo UI
- [ ] Playing the video in the editor shows the actual interactions (clicks, scrolls, navigation), not a static screenshot
- [ ] Each DOM event includes semantic fields: tagName, id, className, innerText, alt, title, aria-label, aria-describedby, href, type, name, placeholder, role
- [ ] DOM events are timestamped and synchronized with video frames
- [ ] Thumbnails extracted from the recorded video show different frames (not all identical)
- [ ] Recording start/stop/pause/resume work correctly
- [ ] Existing tests pass (460+)
- [ ] New tests cover: frame capture pipeline, element snapshot extraction, metadata round-trip
- [ ] `summarizeDOMEvents` in `prompt-templates.ts` uses new metadata fields (alt, title, aria-label, href, type) in AI prompts
- [ ] `DOMEvent` interface extended with semantic fields: tagName, alt, title, ariaLabel, href, elementType, role, name, placeholder

## Acceptance Criteria — Phase 2 (later)

- [ ] Each DOM event additionally includes: computed styles (color, fontSize, position), bounding rect, parent chain (ancestor tags), sibling context
- [ ] On each navigation: capture document.title, meta description, heading hierarchy (h1-h6), landmark roles
- [ ] Page-level context stored as a separate event type in the events array

## Assumptions Exposed & Resolved

| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| getDisplayMedia works in Electron | Failed repeatedly — produces single frame | Replaced with capturePage → FFmpeg pipe |
| Desktop/window capture shows webview changes | Not reliably — webview renders in separate process | Capture webview content directly via its WebContents |
| MediaRecorder + WebM is required | It's the web standard but unreliable in Electron | Bypass entirely — pipe raw frames to FFmpeg for direct MP4 output |
| Basic DOM event data is enough for script gen | Missing semantic fields (alt, aria, href, type) | Enhanced to full element snapshots with computed styles and parent chain |

## Technical Context

### Current Architecture (broken)
```
RecordingControls → getDisplayMedia() → MediaRecorder → WebM blob → IPC → FFmpeg → MP4
                                  ↑
                    setDisplayMediaRequestHandler → desktopCapturer.getSources()
```
Problem: `desktopCapturer` source produces only one frame.

### New Architecture
```
RecordingControls → IPC "recording:start" → Main process starts:
  1. Frame capture loop: setInterval(15fps) → webviewWC.capturePage() → NativeImage → pipe to FFmpeg stdin
  2. DOM event capture: injected script → postMessage → webview preload → IPC → events array

Main process FFmpeg:
  spawn('ffmpeg', ['-f', 'image2pipe', '-framerate', '15', '-i', 'pipe:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '23', output.mp4])
  
  Each frame: nativeImage.toJPEG(80) → write to ffmpeg.stdin

On stop: close ffmpeg.stdin → FFmpeg finalizes MP4 → return videoPath
```

### Key Files to Modify
- `src/main/index.ts` — remove `setDisplayMediaRequestHandler` and `desktopCapturer`
- `src/main/ipc/recording.ipc.ts` — add frame capture loop using `webContents.capturePage()` + FFmpeg pipe
- `src/renderer/components/browser/RecordingControls.tsx` — remove `getDisplayMedia`/`MediaRecorder`, simplify to IPC-only start/stop
- `src/main/services/dom-capture.ts` — enhance injected script to collect full element snapshots
- `src/preload/webview-preload.ts` — relay enhanced event data
- `src/main/workers/recording-worker.ts` — may be simplified or replaced by inline FFmpeg pipe

### Key Files to NOT Modify
- `src/renderer/components/preview/PlaybackPanel.tsx` — works with any MP4
- `src/renderer/components/preview/VideoPlayer.tsx` — works with any MP4
- `src/renderer/stores/timeline-store.ts` — unchanged
- `src/main/utils/ffmpeg.ts` — thumbnail extraction still uses FFmpeg

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Recording | core domain | id, projectId, status, startTime, frames[], events[] | belongs to Project, produces Clip |
| Clip | core domain | id, filePath, duration, url, resolution | created from Recording, contains Segments |
| DOMEvent | supporting | timestamp, type, coordinates, selector, elementSnapshot | belongs to Recording |
| ElementSnapshot | supporting | tagName, id, className, innerText, alt, title, ariaLabel, href, type, role, boundingRect, computedStyles, parentChain | embedded in DOMEvent |
| Script | core domain | sections, prompt, clipId | generated from DOMEvents + Clip |
| Webview | external system | webContentsId, url, preload | source of frames and events |
| FFmpegPipe | supporting | stdin, process, outputPath | converts frames to MP4 |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 5 | 5 | - | - | N/A |
| 2 | 6 | 1 | 0 | 5 | 83% |
| 3 | 7 | 1 | 0 | 6 | 86% |
| 4 | 7 | 0 | 0 | 7 | 100% |
| 5 | 8 | 1 | 0 | 7 | 88% |
| 6 | 8 | 0 | 0 | 8 | 100% |
| 7 | 8 | 0 | 0 | 8 | 100% |

## Interview Transcript

<details>
<summary>Full Q&A (4 rounds)</summary>

### Round 1
**Q:** The video capture keeps failing because we're trying to capture a desktop/window source via desktopCapturer, which doesn't reliably produce continuous video in Electron's sandboxed renderer. There are two fundamentally different approaches to fix this. Which direction matches your vision?
**A:** Capture the webview content directly — records ONLY what's inside the browser area, clean, cropped to the website.
**Ambiguity:** 53% (Goal: 0.55, Constraints: 0.40, Criteria: 0.35, Context: 0.60)

### Round 2
**Q:** When you play back a finished recording in the editor, what would make you say 'yes, this is exactly right'?
**A:** Smooth video (15+ fps) + rich DOM metadata — video shows every interaction fluidly, each interaction has associated metadata. The AI can describe what happened from metadata alone, video is for the visual tutorial output.
**Ambiguity:** 38% (Goal: 0.65, Constraints: 0.45, Criteria: 0.70, Context: 0.65)

### Round 3
**Q:** For the AI script generator to produce quality narration, what EXACTLY should be captured per DOM interaction?
**A:** Full element snapshot — everything semantic PLUS computed styles, bounding rect, parent chain, sibling context.
**Ambiguity:** 24% (Goal: 0.80, Constraints: 0.70, Criteria: 0.80, Context: 0.70)

### Round 4
**Q:** The getDisplayMedia + desktopCapturer approach has failed repeatedly. Should we bypass it entirely with webContents.capturePage() → FFmpeg?
**A:** Yes, bypass getDisplayMedia entirely — use capturePage at 15fps, pipe to FFmpeg. Goes straight to MP4.
**Ambiguity:** 18% (Goal: 0.90, Constraints: 0.70, Criteria: 0.85, Context: 0.75)

### Round 5
**Q:** Beyond individual interactions, should we capture page-level context at each navigation?
**A:** Page structure + interacted elements — on navigation: capture document.title, meta description, heading hierarchy, landmark roles. For interactions: full element snapshots.
**Ambiguity:** 15% (Goal: 0.90, Constraints: 0.80, Criteria: 0.85, Context: 0.80)

### Round 6 (Simplifier mode)
**Q:** Could we ship in two phases — first get video capture working with basic semantic metadata, then enhance richness later?
**A:** Yes, two phases — Phase 1: fix video + semantic fields. Phase 2: computed styles, bounding rects, parent chain, page structure.
**Ambiguity:** 10% (Goal: 0.95, Constraints: 0.85, Criteria: 0.90, Context: 0.85)

### Round 7
**Q:** Should we update the prompt template and summarizeDOMEvents to actually USE the new metadata fields in AI prompts?
**A:** Yes — update summarizeDOMEvents to include alt, title, aria-label, href, type. Otherwise we're collecting data nobody reads.
**Ambiguity:** 7% (Goal: 0.95, Constraints: 0.90, Criteria: 0.95, Context: 0.90)

</details>
