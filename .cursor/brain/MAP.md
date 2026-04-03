# System Map: youtube-transcript-notes

## Main Flows

### Agent summary flow

The user supplies a YouTube URL. The agent runs `agent:prepare` via `agentWorkflowCli`, which calls `prepareAgentWorkflow()` and `runPipeline()` to produce subtitles or Whisper fallback, then assembles artifacts. The chat step reads `manifest.json` and `summary-prompt.md`, writes `summary.<replyLanguage>.md` (default: `summary.ru.md`), runs `agent:check-summary` until validation passes, and answers in the configured reply language. Implementation spine: `src/cli/agentWorkflowCli.ts` and `src/summary/agentWorkflow.ts`; validation: `src/cli/summaryValidatorCli.ts` with rules in `src/summary/summaryContract.ts` and `src/summary/outputLanguage.ts`.

### Transcript generation flow

`src/pipeline/pipeline.ts` orchestrates manual subtitles (`ytDlp`), ranked VTT selection, auto-caption fallback, then audio plus Whisper if needed. WebVTT is parsed and cleaned in `parseVtt.ts`, with scoring in `pickBestVtt.ts`. For YouTube auto tracks only, `collapseRollingAutoCaptions()` in `collapseRollingCaptions.ts` merges rolling prefix growth and trims sliding-window overlaps (suffix/prefix overlap math lives in `suffixPrefixOverlap.ts`, shared with the quality harness). Output is formatted in `formatTranscript.ts`. Shared process execution lives in `runCmd.ts`.

### Transcript quality evaluation

`fixtures/transcript-quality/` stores the transcript quality corpus with language/tag metadata. `src/transcript/qualityFixtureLoader.ts` loads and validates that corpus, `src/transcript/qualityHarness.ts` computes metrics and acceptance checks over the current `collapseRollingAutoCaptions()` behavior (overlap/prefix metrics use `suffixPrefixOverlap.ts`), and `src/cli/transcriptQualityCli.ts` exposes this as `npm run eval:transcript-quality`. `npm run ci` runs this harness after tests and build so caption-cleanup regressions fail CI.

## File responsibilities

- `src/cli/` — `transcriptCli` (standalone URL → transcript file; npm `dev` / packaged `yt-transcript`); `agentWorkflowCli`, `summaryValidatorCli`, `transcriptQualityCli` for prepare bundle, summary validation, and caption-quality eval
- `src/summary/agentWorkflow.ts` — artifact paths, prompt assembly, rollback of partial prepare outputs (not the user-owned summary file)
- `src/summary/outputLanguage.ts` — single source of truth for reply language code, headings, summary filename, ambiguity fallback, and prompt placeholders
- `src/summary/summaryContract.ts` — summary shape and validation rules derived from the configured output language
- `src/pipeline/pipeline.ts` — subtitle and Whisper orchestration
- `src/pipeline/ytDlp.ts` — metadata and downloads; `--sub-langs` from `YT_TRANSCRIPT_SUB_LANGS` or a bounded default
- `src/pipeline/whisperFallback.ts` — Whisper invocation and VTT loading
- `src/transcript/` — VTT parsing, picking, auto-caption collapse, formatting; `suffixPrefixOverlap.ts` — shared adjacency overlap for collapse + quality metrics; `types.ts` holds transcript metadata types used by manifest and pipeline
- `fixtures/transcript-quality/` plus `src/transcript/qualityFixtureLoader.ts` / `qualityHarness.ts` — file-based transcript quality corpus, loader, metrics, and acceptance gates for auto-caption cleanup changes
- `src/shared/runCmd.ts` — command runner with missing-binary messaging
- `prompts/video-notes-prompt.md` — summary template for assembly

## Artifact contract

Each video folder under `artifacts/videos/<videoId>/` holds `transcript.md`, `summary-prompt.md`, `summary.<replyLanguage>.md`, and `manifest.json`. Agent order: read manifest and prompt, write the language-specific summary file, validate, use `transcript.md` only as fallback or deep check.
