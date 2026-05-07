# Open Questions

## workspace-preset-restructure - 2026-04-11

- [ ] Should the `editing` preset redirect to `compose` or `script` for users who have persisted settings with `editing` as their saved preset? -- Affects migration UX for returning users
- [ ] Should the ViewModeToggle (Script/Timeline sub-view toggle) remain in the toolbar for compose and script presets, or is it no longer needed since each preset has a fixed layout? -- Determines whether ViewModeToggle.tsx needs updating or can be removed entirely
- [ ] Should the existing `OpenAIProvider` class (openai-provider.ts) be renamed to `CodexProvider` in-place, or should a new file be created alongside it? -- The current `OpenAIProvider` already uses the `codex` CLI binary. Renaming avoids duplication but is a larger diff.
- [ ] What is the desired behavior when a user drags a DOM event chip that is already assigned to another step? -- Should it move (remove from old step, add to new) or copy (keep in both)?
- [ ] Should the storyboard auto-populate with steps when switching to Compose view for the first time, or only when explicitly triggered? -- Affects the `syncFromTimeline` call timing
- [ ] What WPM value should be the default for freeze-frame calculation? Industry standard for narration is 130-160 WPM. -- Affects freeze-frame duration accuracy
- [ ] Should the streaming operation log be shared between Compose and Script presets, or is it only visible in Script view? -- Determines whether the log component lives in a shared location
