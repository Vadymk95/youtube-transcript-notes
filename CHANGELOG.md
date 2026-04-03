# Changelog

## 1.2.0 — 2026-04-03

### Added

- Collapse rolling YouTube **auto** caption cues (prefix-extending chains and sliding-window overlap) before writing the transcript so `transcript.md` / `summary-prompt.md` are not filled with duplicate partial lines.

### Changed

- Default yt-dlp `--sub-langs` for manual and auto captions is a bounded list (`en,en-US,en-orig,ru,uk,-live_chat`) instead of `all,-live_chat`, which greatly reduces HTTP 429 from YouTube. **Migration:** if you depend on other caption languages, set `YT_TRANSCRIPT_SUB_LANGS` (for the old behavior — not recommended — use `all,-live_chat`).

## 1.0.0

### Breaking

- Global npm binary `yt-transcript` now points to `dist/cli/transcriptCli.js` (was `dist/cli.js`). Re-link or reinstall the package after upgrading.

### Added

- Agent workflow: `npm run agent:prepare` writes `artifacts/videos/<videoId>/` (transcript, summary prompt, manifest) and `npm run agent:check-summary` validates `summary.ru.md`.
- On a failed `prepareAgentWorkflow` run, partial files from that run (`transcript.md`, `summary-prompt.md`, `manifest.json`) are removed so the artifact folder does not stay in an inconsistent state.

### Changed

- Source layout: `src/cli/`, `src/pipeline/`, `src/shared/`, `src/summary/`, `src/transcript/`.
