# System Map: youtube-transcript-notes

## Main Flows

### Agent summary flow

The user supplies a YouTube URL. The agent runs `agent:prepare` via `agentWorkflowCli`, which calls `prepareAgentWorkflow()` and `runPipeline()` to produce subtitles or Whisper fallback, then assembles artifacts. The chat step reads `manifest.json` and `summary-prompt.md`, writes `summary.ru.md`, runs `agent:check-summary` until validation passes, and answers in Russian. Implementation spine: `src/cli/agentWorkflowCli.ts` and `src/summary/agentWorkflow.ts`; validation: `src/cli/summaryValidatorCli.ts` with rules in `src/summary/summaryContract.ts`.

### Transcript generation flow

`src/pipeline/pipeline.ts` orchestrates manual subtitles (`ytDlp`), ranked VTT selection, auto-caption fallback, then audio plus Whisper if needed. WebVTT is parsed and cleaned in `parseVtt.ts`, with scoring in `pickBestVtt.ts`. For YouTube auto tracks only, `collapseRollingAutoCaptions()` in `collapseRollingCaptions.ts` merges rolling prefix growth and trims sliding-window overlaps. Output is formatted in `formatTranscript.ts`. Shared process execution lives in `runCmd.ts`.

## File responsibilities

- `src/cli/` — transcript CLI, agent prepare, summary validator entrypoints
- `src/summary/agentWorkflow.ts` — artifact paths, prompt assembly, rollback of partial prepare outputs (not `summary.ru.md`)
- `src/summary/summaryContract.ts` — Russian summary shape and validation rules
- `src/pipeline/pipeline.ts` — subtitle and Whisper orchestration
- `src/pipeline/ytDlp.ts` — metadata and downloads; `--sub-langs` from `YT_TRANSCRIPT_SUB_LANGS` or a bounded default
- `src/pipeline/whisperFallback.ts` — Whisper invocation and VTT loading
- `src/transcript/` — VTT parsing, picking, auto-caption collapse, formatting; `types.ts` holds transcript metadata types used by manifest and pipeline
- `src/shared/runCmd.ts` — command runner with missing-binary messaging
- `prompts/video-notes-prompt.md` — summary template for assembly

## Artifact contract

Each video folder under `artifacts/videos/<videoId>/` holds `transcript.md`, `summary-prompt.md`, `summary.ru.md`, and `manifest.json`. Agent order: read manifest and prompt, write `summary.ru.md`, validate, use `transcript.md` only as fallback or deep check.
