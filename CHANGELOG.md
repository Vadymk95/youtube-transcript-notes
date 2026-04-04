# Changelog

## 1.5.1 — 2026-04-04

### Changed

- Summary prompt and injected `REQUIRED_OUTPUT_FORMAT`: BLUF-first topic, clearer outline vs main-ideas roles, reading-order hint for humans, and speculative-language rules aligned with the validator (ambiguity section + handoff risks only).
- CLI `--help` for `agent:prepare` and `agent:check-summary` now shows correct packaged paths under `dist/cli/`.

## 1.4.0 — 2026-04-03

### Added

- `src/transcript/suffixPrefixOverlap.ts` — shared suffix/prefix overlap used by `collapseRollingAutoCaptions` and transcript quality metrics.
- `npm run eval:transcript-quality -- --json --compact` to omit `cleanedSegments` from JSON output.

### Changed

- `npm run ci` now runs `eval:transcript-quality` after build.
- Agent workflow rollback logs `console.warn` when an artifact file cannot be removed during cleanup.

## 1.3.0 — 2026-04-03

### Added

- Open-source friendly README quick start for Cursor / Claude Code and CLI usage.
- Central `src/summary/outputLanguage.ts` config so output language, summary filename, validator headings, ambiguity fallback, and prompt placeholders can be changed in one place.

### Changed

- Agent workflow summary artifact is now language-coded as `summary.<replyLanguage>.md` (default remains `summary.ru.md`).
- Prompt assembly and summary validation now derive language-specific behavior from the shared output-language config instead of hardcoded Russian-only wiring.

## 1.2.0 — 2026-04-03

### Added

- Collapse rolling YouTube **auto** caption cues (prefix-extending chains and sliding-window overlap) before writing the transcript so `transcript.md` / `summary-prompt.md` are not filled with duplicate partial lines.
- Add `npm run eval:transcript-quality`, a fixture-based transcript quality harness for autoresearch-style caption cleanup iterations with reject/accept gates.

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
