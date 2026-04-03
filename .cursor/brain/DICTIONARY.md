# Project Dictionary

- **Artifact bundle** — the per-video output directory under `artifacts/videos/<videoId>/`
- **Transcript** — the timestamped markdown file generated from subtitles or Whisper
- **Summary prompt** — the model-ready prompt assembled from the template and transcript
- **Russian handoff summary** — the final structured `summary.ru.md` file written for the next AI agent
- **Manifest** — machine-friendly JSON with artifact paths and metadata for the agent
- **Ralph Method** — the loop `write summary -> validate -> rewrite if needed` until the summary passes the validator
- **Manual subtitles** — subtitles downloaded via `yt-dlp --write-subs`
- **Auto subtitles** — subtitles downloaded via `yt-dlp --write-auto-subs`
- **Whisper fallback** — local audio download and transcription path used when subtitles are missing or too short
- **`minSubtitleChars`** — acceptance threshold used before triggering a deeper fallback
