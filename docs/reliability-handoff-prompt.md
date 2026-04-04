# Handoff prompt: pipeline reliability and metadata (for another model)

Copy the block below into a chat with a coding agent or planner. It states real incidents, expected fixes, and how they line up with the repo roadmap.

---

You are working on the **youtube-transcript-notes** repository: a **local-first** pipeline that turns a YouTube URL into `transcript.md`, `summary-prompt.md`, and `manifest.json` under `artifacts/videos/<videoId>/`, using **yt-dlp** (subtitles first, optional **Whisper** on audio if subtitles fail).

## What actually went wrong (observed)

1. **HTTP 429 on subtitles**
   With the default `YT_TRANSCRIPT_SUB_LANGS` list (`en,en-US,en-orig,ru,uk,-live_chat`), **yt-dlp** requested multiple caption tracks; **YouTube** returned **429 Too Many Requests** for at least one language (`en`). Subtitle files did not land; the pipeline treated subtitles as unavailable.

2. **Whisper fallback failed immediately**
   The next stage downloaded audio and invoked the default shell command for **Whisper**, but the **`whisper` CLI was not installed** (`command not found`). The whole `agent:prepare` run aborted.

3. **Workaround that succeeded**
   Running with a **single language** avoided the burst of requests:
   `YT_TRANSCRIPT_SUB_LANGS=ru npm run agent:prepare -- "<url>"`
   Transcript source: **subtitle-auto**, language **ru**.

4. **Metadata gap (addressed in code)**
   Previously only **video id** and **title** were fetched for the transcript front matter and manifest. **YouTube description** (links, timestamps, affiliate notes) was **not** included, so the summarization step could not ground answers in description-only links.

## What “done” should look like

- **Subtitles path:** Reduce 429 likelihood (sequential language attempts, backoff/retry on 429, clearer error messages pointing to `YT_TRANSCRIPT_SUB_LANGS`), without defaulting to `all` languages (that amplifies 429).
- **Whisper path:** Document and optionally detect missing Whisper **before** audio download; surface a single actionable error (“install Whisper or narrow `YT_TRANSCRIPT_SUB_LANGS`”).
- **Description:** Description is part of the **canonical input** for the summarizing model: it appears in **`transcript.md` YAML** (`description: "<JSON string>"`) when non-empty and in **`manifest.json`** as **`videoDescription`** (may be empty string). Summaries should still follow the **transcript-first** rule: do not invent facts; description may contain links the audio never mentions.

## Alignment with existing technical debt / roadmap

Open **`docs/technical-debt-roadmap.md`** and **`docs/troubleshooting.md`**:

- **Troubleshooting doc** covers `yt-dlp`, `ffmpeg`, Whisper, HTTP **429**, and env flags — use it for user-facing mitigation (e.g. narrowing `YT_TRANSCRIPT_SUB_LANGS`).
- **DECISIONS (`/.cursor/brain/DECISIONS.md`):** “Bounded default for yt-dlp `--sub-langs`” — explains why the default list is short; it does **not** remove 429 under load, so **optional code hardening** (sequential lang attempts, retry/backoff, clearer preflight errors) remains on the roadmap.

Optional future items from the same roadmap that overlap:

- **Productize the current strengths:** smoother CLI / output modes (could include “retry prepare with suggested env”).
- **Evaluate expansion paths:** structured JSON output (manifest already JSON; any expansion should stay compatible with `videoDescription`).

## Constraints

- Keep the workflow **local-first**; do not make a remote API the default path unless the product owner explicitly asks.
- Preserve the **artifact contract** and **summary validator**; description is extra **context**, not a replacement for transcript grounding rules in `prompts/video-notes-prompt.md`.

---

_End of handoff block._
