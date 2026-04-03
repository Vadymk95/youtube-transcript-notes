# Changelog

## 1.0.0

### Breaking

- Global npm binary `yt-transcript` now points to `dist/cli/transcriptCli.js` (was `dist/cli.js`). Re-link or reinstall the package after upgrading.

### Added

- Agent workflow: `npm run agent:prepare` writes `artifacts/videos/<videoId>/` (transcript, summary prompt, manifest) and `npm run agent:check-summary` validates `summary.ru.md`.
- On a failed `prepareAgentWorkflow` run, partial files from that run (`transcript.md`, `summary-prompt.md`, `manifest.json`) are removed so the artifact folder does not stay in an inconsistent state.

### Changed

- Source layout: `src/cli/`, `src/pipeline/`, `src/shared/`, `src/summary/`, `src/transcript/`.
