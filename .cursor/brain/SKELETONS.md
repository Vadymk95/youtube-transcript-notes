# Hidden Logic and Risks: youtube-transcript-notes

## Technical Risks

- Prompt template contract: `src/summary/agentWorkflow.ts` depends on `prompts/video-notes-prompt.md` containing a `---` separator and `{{TRANSCRIPT}}`. If the template shape changes, prompt assembly can silently break.
- Summary contract drift: `src/summary/summaryContract.ts` validates against the active preset from `resolveSummaryOutputLanguage()` (or `--reply-lang`). Headings must match that preset and `prompts/video-notes-prompt.md` assembly. If the prompt format changes without updating presets and the validator, the Ralph loop will fail.
- External toolchain: the real runtime depends on `yt-dlp`, `ffmpeg`, and optionally Whisper. Missing binaries are the most likely production failure mode.
- YouTube subtitle fetch: using `all` languages in `--sub-langs` can trigger HTTP 429. The default is a short list; widen with `YT_TRANSCRIPT_SUB_LANGS` only when needed.
- Whisper shell execution: `runWhisperToVtt()` executes a shell string from `YT_TRANSCRIPT_WHISPER_CMD` or `--whisper-cmd`. Do not casually change interpolation or quoting rules.
- Summary command shell: `runSummaryShellCommand()` executes `YT_SUMMARY_CMD` / `--summary-cmd` like Whisper; untrusted templates are unsafe.
- Artifact contract drift: the agent flow assumes `manifest.json -> summary-prompt.md -> summary.<replyLanguage>.md -> validator`. Renaming files or changing manifest fields (including `videoDescription`) without updating the rules breaks the chat workflow.
- Agent prepare rollback: if `prepareAgentWorkflow()` fails after `runPipeline` writes `transcript.md`, it deletes `transcript.md`, `summary-prompt.md`, and `manifest.json` produced in that run (in reverse order). It does not delete the final summary file (user-owned). If an `unlink` during rollback fails, failures are logged with `console.warn` and the original error is still rethrown upstream.

## Logical Risks

- Never summarize from the YouTube title or URL alone when the transcript workflow is available. Ground facts in the **transcript**; **`videoDescription`** (and YAML `description` in `transcript.md`) supplements links and page text but is still not a substitute for checking what was actually said when the prompt forbids invention.
- Translation drift risk: any summary can become factually wrong if the agent adds interpretation that is not grounded in the transcript; this gets riskier when output-language config and prompt expectations diverge.
- Do not introduce a second default orchestration path through an external MCP or remote summarizer without explicit user approval. This repo is intentionally local-first.
- `minSubtitleChars` controls when the pipeline accepts manual or auto subtitles before Whisper fallback. Changing the threshold changes behavior more than it looks.
- Auto-caption cleanup uses conservative prefix/overlap heuristics. Strange YouTube cue timing can still leave redundant lines, and looser thresholds could falsely trim legitimate repeated phrasing or sentence restarts.
- The transcript quality harness reduces regression risk, but a narrow fixture set can still let the cleanup logic overfit to today's examples and miss new caption patterns. Overlap-related harness metrics intentionally reuse `suffixPrefixOverlap.ts` with `collapseRollingAutoCaptions()` so counts stay aligned; prefix-chain metrics use the same `norm()` as the collapser (case-sensitive whitespace normalization).
- Transcript length can be very large. Prefer `summary-prompt.md` as the primary agent input; use `transcript.md` only when validation or deeper inspection is needed. Check `manifest.json` fields `transcriptFileChars`, `transcriptBodyChars`, and long `videoDescription` before assuming the prompt fits a given model context window.
