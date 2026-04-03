# Hidden Logic and Risks: youtube-transcript-notes

## Technical Risks

- Prompt template contract: `src/summary/agentWorkflow.ts` depends on `prompts/video-notes-prompt.md` containing a `---` separator and `{{TRANSCRIPT}}`. If the template shape changes, prompt assembly can silently break.
- Summary contract drift: `src/summary/summaryContract.ts` assumes exact Russian headings and subheadings. If the prompt format changes without updating the validator, the Ralph loop will fail.
- External toolchain: the real runtime depends on `yt-dlp`, `ffmpeg`, and optionally Whisper. Missing binaries are the most likely production failure mode.
- Whisper shell execution: `runWhisperToVtt()` executes a shell string from `YT_TRANSCRIPT_WHISPER_CMD` or `--whisper-cmd`. Do not casually change interpolation or quoting rules.
- Artifact contract drift: the agent flow assumes `manifest.json -> summary-prompt.md -> summary.ru.md -> validator`. Renaming files or changing manifest fields without updating the rules breaks the chat workflow.
- Agent prepare rollback: if `prepareAgentWorkflow()` fails after `runPipeline` writes `transcript.md`, it deletes `transcript.md`, `summary-prompt.md`, and `manifest.json` produced in that run (in reverse order). It does not delete `summary.ru.md` (user-owned).

## Logical Risks

- Never summarize from the YouTube title or URL alone when the transcript workflow is available. The transcript is the only reliable content source.
- Translation drift risk: a Russian summary can become factually wrong if the agent adds interpretation that is not grounded in the transcript.
- Do not introduce a second default orchestration path through an external MCP or remote summarizer without explicit user approval. This repo is intentionally local-first.
- `minSubtitleChars` controls when the pipeline accepts manual or auto subtitles before Whisper fallback. Changing the threshold changes behavior more than it looks.
- Transcript length can be very large. Prefer `summary-prompt.md` as the primary agent input; use `transcript.md` only when validation or deeper inspection is needed.
