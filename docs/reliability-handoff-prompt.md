# Handoff prompt: pipeline reliability and metadata (for another model)

Copy the block below into a chat with a coding agent or planner. It states real incidents, expected fixes, and how they line up with the repo roadmap.

---

You are working on the **youtube-transcript-notes** repository: a **local-first** pipeline that turns a YouTube URL into `transcript.md`, `summary-prompt.md`, `manifest.json`, and `cursor-handoff.md` under `artifacts/videos/<videoId>/`, using **yt-dlp** (subtitles first, optional **Whisper** on audio if subtitles fail).

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

## Alignment with repo docs

Open **`docs/technical-debt-roadmap.md`** (condensed **open backlog only**), **`docs/troubleshooting.md`**, and **`.cursor/brain/DECISIONS.md`**:

- **Prepare path:** Sequential `--sub-langs`, 429 retry, Whisper preflight before audio, and description in manifest are **implemented** — see DECISIONS and pipeline source.
- **Troubleshooting** remains the user-facing mitigation guide (429, env vars, binaries).
- **Remaining backlog** in the roadmap file is **product evolution** (batch URLs, denser second-hop summaries, exploratory multimodal/UI, archive) — see [technical-debt-roadmap.md](./technical-debt-roadmap.md). It does not re-open the fixed incidents above unless regressions appear.

## Constraints

- Keep the workflow **local-first**; do not make a remote API the default path unless the product owner explicitly asks.
- Preserve the **artifact contract** and **summary validator**; description is extra **context**, not a replacement for transcript grounding rules in `prompts/video-notes-prompt.md`.

---

_End of handoff block._
