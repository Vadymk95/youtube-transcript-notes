# System Map: youtube-transcript-notes

## Main Flows

### Agent Summary Flow

```text
User message with YouTube URL
  -> agent runs `npm run agent:prepare -- "<url>"`
  -> `src/cli/agentWorkflowCli.ts`
  -> `prepareAgentWorkflow()` in `src/summary/agentWorkflow.ts`
  -> `runPipeline()` in `src/pipeline/pipeline.ts`
  -> subtitles path or Whisper fallback
  -> `transcript.md`
  -> `summary-prompt.md`
  -> `summary.ru.md`
  -> `npm run agent:check-summary -- "<summary-file>"`
  -> `manifest.json`
  -> agent reads artifacts and answers in Russian
```

### Transcript Generation Flow

```text
`src/pipeline/pipeline.ts`
  -> `downloadManualSubs()` from `src/pipeline/ytDlp.ts`
  -> score `.vtt` files via `pickBestVtt()`
  -> fallback to `downloadAutoSubs()`
  -> fallback to `downloadAudio()` + `runWhisperToVtt()`
  -> parse VTT via `parseWebVtt()`
  -> format transcript via `toMarkdown()` or `toPlainText()`
```

## File Responsibilities

- `src/cli/` — CLI entrypoints for transcript generation, agent workflow, and summary validation
- `src/summary/agentWorkflow.ts` — canonical artifact assembly for agent use; on failure after `transcript.md` is written, rolls back `transcript.md` / `summary-prompt.md` / `manifest.json` from that run (via `rollbackAgentArtifactFiles`)
- `src/summary/summaryContract.ts` — required Russian summary format and validation rules
- `src/pipeline/pipeline.ts` — orchestration for subtitles and Whisper fallback
- `src/pipeline/ytDlp.ts` — metadata fetch, subtitles download, audio extraction
- `src/pipeline/whisperFallback.ts` — Whisper shell execution and VTT loading
- `src/transcript/parseVtt.ts` — WebVTT parsing and cleanup
- `src/transcript/pickBestVtt.ts` — subtitle scoring and language inference
- `src/transcript/formatTranscript.ts` — markdown/plain transcript formatting
- `src/shared/runCmd.ts` — command execution helper with friendly missing-binary errors
- `prompts/video-notes-prompt.md` — summary prompt template

## Artifact Contract

The canonical output directory is:

```text
artifacts/videos/<videoId>/
  transcript.md
  summary-prompt.md
  summary.ru.md
  manifest.json
```

Agent contract:

1. Read `manifest.json`
2. Read `summary-prompt.md`
3. Write `summary.ru.md`
4. Run the validator until it passes
5. Use `transcript.md` only as a raw fallback or for validation
