# Troubleshooting

Quick reference for the most common **local-first** pipeline failures. For incident-style context and roadmap alignment, see [reliability-handoff-prompt.md](./reliability-handoff-prompt.md).

## yt-dlp

- **Not found**: install [yt-dlp](https://github.com/yt-dlp/yt-dlp) and ensure it is on `PATH`, or set `YT_DLP_BIN` to the binary path.
- **Subtitles missing**: try `YT_TRANSCRIPT_DEBUG=1` or `NODE_DEBUG=yt-transcript:ytdlp` to print subtitle attempt failures on stderr.
- **HTTP 429 (Too Many Requests)**: YouTube may rate-limit when many caption languages are requested. The default `YT_TRANSCRIPT_SUB_LANGS` is intentionally small; try narrowing further (e.g. one language: `YT_TRANSCRIPT_SUB_LANGS=ru`). Avoid `all` unless you accept many requests and higher 429 risk.

## ffmpeg

- Required for **audio extraction** when the pipeline falls back to Whisper.
- Install a distro package or official build and ensure `ffmpeg` is on `PATH`.

## Whisper

- Used only when manual/auto subtitles are missing or below `--min-chars`, or when you pass `--force-whisper`.
- If the shell reports **`whisper: command not found`**, install your chosen Whisper CLI (e.g. [openai-whisper](https://github.com/openai/whisper)) or set `YT_TRANSCRIPT_WHISPER_CMD` to a template that invokes your install (placeholders `{{audio}}` and `{{outdir}}`).

## Node / npm

- Use **Node 20+** (see `.nvmrc`). In CI shells without your shell profile, run `nvm use` (or equivalent) before `npm run ci`.

## Summary step

- **`agent:check-summary` fails**: compare your `summary.<lang>.md` headings to `src/summary/outputLanguage.ts` and [video-notes-prompt.md](../prompts/video-notes-prompt.md).
- **Prompt too large for the model**: check `transcriptBodyChars` in `manifest.json` (rough token planning: ~4 characters per token is a common heuristic, plus template overhead).

## Still stuck

Open an issue using the [transcript extraction](../.github/ISSUE_TEMPLATE/transcript-extraction-failure.yml) or [caption quality](../.github/ISSUE_TEMPLATE/caption-quality-bug.yml) template, or read [CONTRIBUTING.md](../CONTRIBUTING.md).
