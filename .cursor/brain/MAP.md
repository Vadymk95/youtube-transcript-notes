# System Map: youtube-transcript-notes

## Main Flows

### Agent summary flow

The user supplies a YouTube URL. The agent runs `agent:prepare` via `agentWorkflowCli`, which calls `prepareAgentWorkflow()` and `runPipeline()` to produce subtitles or Whisper fallback, then assembles artifacts. Optionally **`agent:complete`** (`agentCompleteCli`) runs prepare, a user-defined **`YT_SUMMARY_CMD`** shell, and `validateSummary`. Failed validation prints JSON (and **`agent:check-summary`** prints JSON to stdout) plus **human hints on stderr** from `summaryValidationHints.ts`. The chat step reads `manifest.json` and `summary-prompt.md`, writes `summary.<replyLanguage>.md` (default: `summary.ru.md`), runs `agent:check-summary` until validation passes, and answers in the configured reply language. Implementation spine: `src/cli/agentWorkflowCli.ts`, `src/cli/agentCompleteCli.ts`, `src/summary/agentWorkflow.ts`, `src/summary/agentCompleteFlow.ts`; validation: `src/cli/summaryValidatorCli.ts` with rules in `src/summary/summaryContract.ts` and `src/summary/outputLanguage.ts`.

### Transcript generation flow

`src/pipeline/pipeline.ts` orchestrates manual subtitles (`ytDlp`), ranked VTT selection, auto-caption fallback, then audio plus Whisper if needed. WebVTT is parsed and cleaned in `parseVtt.ts`, with scoring in `pickBestVtt.ts`. For YouTube auto tracks only, `collapseRollingAutoCaptions()` in `collapseRollingCaptions.ts` merges rolling prefix growth and trims sliding-window overlaps (suffix/prefix overlap math lives in `suffixPrefixOverlap.ts`, shared with the quality harness). Output is formatted in `formatTranscript.ts`. Shared process execution lives in `runCmd.ts`.

### Transcript quality evaluation

`fixtures/transcript-quality/` stores the transcript quality corpus with language/tag metadata. `src/transcript/qualityFixtureLoader.ts` loads and validates that corpus, `src/transcript/qualityHarness.ts` computes metrics and acceptance checks over the current `collapseRollingAutoCaptions()` behavior (overlap/prefix metrics use `suffixPrefixOverlap.ts`), and `src/cli/transcriptQualityCli.ts` exposes this as `npm run eval:transcript-quality`. `npm run ci` runs this harness after tests and build so caption-cleanup regressions fail CI.

## Optional process docs (cross-repo and in-repo rhythm)

- Sibling **agent-autoresearch** harness for bounded tasks: `docs/autoresearch-cross-repo-workflow.md` (contract and ledger; no auto-generated patches).
- In-repo framing of bounded verify/keep loops aligned with that style: `docs/bounded-improvement.md`.
- Condensed **open backlog** (goal: shrink to zero and delete): `docs/technical-debt-roadmap.md`.
- Copy-paste handoff for incident-driven reliability work tied to that roadmap: `docs/reliability-handoff-prompt.md`.

## File responsibilities

- `LICENSE`, `CONTRIBUTING.md`, `docs/troubleshooting.md` — OSS contributor baseline
- `.github/workflows/ci.yml` — GitHub Actions running `npm run ci`
- `.github/ISSUE_TEMPLATE/` — bug report templates (transcript extraction, caption quality, summary validation)
- `src/cli/` — `transcriptCli` (standalone URL → transcript file; npm `dev` / packaged `yt-transcript`); `agentWorkflowCli`, `agentCompleteCli`, `summaryValidatorCli`, `transcriptQualityCli` for prepare bundle, optional full loop, summary validation, and caption-quality eval
- `src/summary/agentWorkflow.ts` — artifact paths, prompt assembly, rollback of partial prepare outputs (not the user-owned summary file)
- `src/summary/agentCompleteFlow.ts` — orchestrates prepare + `YT_SUMMARY_CMD` + validation (`runAgentComplete`)
- `src/summary/summaryCommand.ts` — interpolates summary shell placeholders; runs `sh -c` (same risk class as `YT_TRANSCRIPT_WHISPER_CMD`)
- `src/summary/outputLanguage.ts` — preset map (`SUMMARY_LANGUAGE_PRESETS`), `resolveSummaryOutputLanguage()` from `YT_SUMMARY_LANG` / CLI override; headings, summary filename, ambiguity fallback, prompt placeholders
- `src/summary/summaryContract.ts` — summary shape and validation rules derived from the configured output language
- `src/summary/summaryValidationHints.ts` — stderr hint text after validation failures (CLI + `agent:complete`)
- `src/summary/transcriptMetrics.ts` — transcript file and body character counts for `manifest.json` context budgeting
- `src/pipeline/pipeline.ts` — subtitle and Whisper orchestration
- `src/pipeline/ytDlp.ts` — metadata (`fetchVideoInfo` via `--dump-single-json`: id, title, description) and downloads; `--sub-langs` from `YT_TRANSCRIPT_SUB_LANGS` (sequential one positive language per yt-dlp attempt, shared exclusions; optional 429 retry via `YT_TRANSCRIPT_SUB_429_RETRY_MS`) or a bounded default
- `src/pipeline/whisperFallback.ts` — Whisper invocation and VTT loading
- `src/transcript/` — VTT parsing, picking, auto-caption collapse, formatting; `suffixPrefixOverlap.ts` — shared adjacency overlap for collapse + quality metrics; `types.ts` holds transcript metadata types used by manifest and pipeline
- `fixtures/transcript-quality/` plus `src/transcript/qualityFixtureLoader.ts` / `qualityHarness.ts` — file-based transcript quality corpus, loader, metrics, and acceptance gates for auto-caption cleanup changes
- `src/shared/runCmd.ts` — command runner with missing-binary messaging
- `prompts/video-notes-prompt.md` — summary template for assembly

## Artifact contract

Each video folder under `artifacts/videos/<videoId>/` holds `transcript.md`, `summary-prompt.md`, `summary.<replyLanguage>.md`, and `manifest.json`. `manifest.json` includes `transcriptFileChars`, `transcriptBodyChars`, and **`videoDescription`** (YouTube description text, may be empty). `transcript.md` YAML may include **`description`** when non-empty. Agent order: read manifest and prompt, write the language-specific summary file, validate, use `transcript.md` only as fallback or deep check.
