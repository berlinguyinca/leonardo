# Road to Production — Leonardo

**Date:** 2026-04-22
**Branch:** `feature/workspace-preset-restructure` (18,432 lines vs `main`, 185 files)
**Author:** Claude (audit + roadmap)

## Current State

| Signal | Status |
|---|---|
| Unit + integration tests | **991 / 991 passing** (127 files, 11.6s) |
| Typecheck (`npm run lint`) | **Clean** (6 errors fixed in this session) |
| Playwright e2e | 3 specs wired but not part of `npm test` |
| Uncommitted WIP | 26 modified + 12 new files — in-progress spec work |
| Secrets / env scan | Clean (no hardcoded keys; only `process.env` passthroughs) |
| Security-hardening commit | Landed (`ac4f155`) — media:// validation, safeHandle re-throw, CLIP_DELETE txn, logger rotation, Ollama timeouts |
| CI / GitHub Actions | **None** |
| Packaging (electron-builder) | **No config** — cannot build installers |
| Specs implemented | 5 of 6 complete; `script-view-redesign` ~80% (TS plumbing drift, now fixed) |

## Audit Findings (Punch List)

### Fixed in this session
- [x] **TS-1** `src/main/index.ts` — unused `net` import → removed
- [x] **TS-2** `src/preload/index.ts` — `generateScript` / `generateScriptStream` return types missing `generationLog?: GenerationLog` → added (accounts for 4 of 6 TS errors)
- [x] **TS-3** `ScriptEditorPanel.tsx:124` — unreachable `existing?.scriptId` in `else`-branch → simplified to `activeSections[0]?.scriptId ?? ''`

### Ship-blocking — must do before v0.1.0 tag
- [ ] **SB-1** **No packaging config.** `package.json` has `build: electron-vite build` but no `electron-builder` section. Cannot produce .dmg/.exe. Needs `electron-builder` dep + config (mac/win/linux targets, app id, icon, auto-updater stub).
- [ ] **SB-2** **No CI.** Zero `.github/workflows`. Need at minimum: lint + test on PR, optional e2e nightly.
- [ ] **SB-3** **In-flight spec not merged.** `feature/workspace-preset-restructure` has 18k+ line diff vs `main`. Merging requires the spec to be truly complete and tests green.
- [ ] **SB-4** **36 uncommitted files.** Need a clean working tree before any release tag. Decide: commit (if intentional WIP) or revert.

### High priority — production polish
- [ ] **HP-1** **Script view redesign — final wiring.** `script-view-redesign` spec is 80%+ implemented based on commits, but drifted from the plan's Task 2 type plumbing (now fixed). Confirm all 8 tasks' checkboxes map to landed work; close the plan file.
- [ ] **HP-2** **Runtime smoke tests.** `tests/integration/runtime-behavior.test.ts` is new but untracked. Memory says "89% of tests mocked" was a prior issue — verify real-IPC round-trip tests exist for each critical feature (recording, TTS, script gen, timeline persist).
- [ ] **HP-3** **Playwright e2e in CI.** 3 specs exist (`app-launch`, `project-crud`, `recording-flow`) but `test:e2e` is not run by `npm test`. Either add to CI or accept as dev-only.
- [ ] **HP-4** **Bundle warning — dynamic vs static import.** `ollama-provider.ts` and `toast-store.ts` are both statically and dynamically imported; `dynamic import will not move module into another chunk`. Pick one strategy per module; prevents dead-code elimination.
- [ ] **HP-5** **Auto-updater.** Not wired. Ship without and defer, or add `electron-updater` + release feed.

### Medium priority — deferred
- [ ] **MP-1** Crash reporting / telemetry (Sentry or similar) — not present.
- [ ] **MP-2** App icons (mac `.icns`, win `.ico`, linux `.png`) — verify present in build config.
- [ ] **MP-3** App menu (File/Edit/View) — unknown state; check `createWindow` in `main/index.ts`.
- [ ] **MP-4** License metadata for bundled media (msedge-tts, ffmpeg binary if bundled).
- [ ] **MP-5** "100% test coverage" target — **rejected as stated**. Target *critical-path* coverage (recording, script-gen, TTS, playback, persist) at 90%+ line, everything else best-effort. Coverage gate in CI (e.g., `vitest --coverage` with minimum thresholds).

### Low priority — nice to have
- [ ] **LP-1** Crash-safe project recovery (.leo file rotation).
- [ ] **LP-2** Performance: virtualize `ScriptTextTrack` when >20 sections (noted in spec).
- [ ] **LP-3** Accessibility audit — keyboard-only nav, ARIA on custom controls.

## Roadmap — Sequenced

### Phase A: Close the feature branch (this session)
1. Finish `script-view-redesign` remaining work (if any). TS errors already fixed; re-run full suite to confirm.
2. Inspect uncommitted diff — commit intentional changes, revert the rest.
3. Stop the bleed: no new features until branch lands.

### Phase B: Release infrastructure (next session)
1. Add `electron-builder` config + dep (SB-1).
2. Add GitHub Actions: lint + test on PR (SB-2).
3. Smoke-test a local `npm run build` + packaged installer.

### Phase C: Merge + tag v0.1.0
1. PR to `main`.
2. Tag `v0.1.0`.
3. Optional: release workflow builds installers from tag.

### Phase D: Post-launch hardening
- MP items (icons, menus, telemetry).
- Coverage gate in CI.
- Auto-updater.

## Scope Decisions

- **"100% test coverage" is not a target.** Critical-path coverage + lint-clean + e2e smoke is the bar for v0.1.0.
- **"Ship to production"** is interpreted as: tagged release with installer artifacts, clean CI, and the feature branch merged to main. Not app-store submission.
- **"Implement missing spec features"** is interpreted as: close gaps in the only active spec (`script-view-redesign`). The other 5 specs are complete per memory and commit history.

## Rejected / Out-of-Scope
- Building new features beyond active spec.
- Refactoring for its own sake.
- Coverage of trivial UI glue code.
- Per-OS code-signing / notarization (defer to post-launch).
