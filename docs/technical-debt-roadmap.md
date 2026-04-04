# Open backlog (technical debt)

**Intent:** This file lists only **unfinished** work. When the list is empty, **delete this file** and remove links from `CONTRIBUTING.md`, `MAP.md`, and `docs/reliability-handoff-prompt.md`. Older market/strategy notes live in git history.

## P0 — productization

- **Bundled or guided summarizer** for users who will not write `YT_SUMMARY_CMD` (stay local-first; no remote API as default).
- **Optional summary shapes** beyond the strict handoff contract (e.g. short summary, outline) — requires aligned prompt + validator changes.
- **More README examples** for specific local CLIs (Ollama, etc.) if needed beyond the current recipe shapes + env table.

## P1 — quality moat

- Expand **transcript quality fixtures** (`fixtures/transcript-quality/`).
- **External benchmark** (fixed video set vs raw YouTube / `yt-dlp` alone / npm transcript helpers); document regression expectations.

## P2 — later

- Batch URLs / playlists (power-user; watch scraping risk).
- Searchable archive / semantic retrieval workflow.
- UI or browser extension.

## Non-goals (unchanged)

- All-in-one YouTube toolkit, cloud summarizer as default, large-scale channel scraping, major UI before core workflow is mature.

---

**Recently shipped (do not re-list above):** sequential `--sub-langs` + 429 retry + Whisper preflight; README env/manifest quick reference; **stderr hint blocks** after failed `agent:complete` / `agent:check-summary` (`src/summary/summaryValidationHints.ts`).
