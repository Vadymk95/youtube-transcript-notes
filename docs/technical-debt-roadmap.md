# Open backlog (technical debt)

**Only unfinished work.** When the list is empty, delete this file and remove links from `CONTRIBUTING.md`, `.cursor/brain/MAP.md`, and `docs/reliability-handoff-prompt.md`.

**Process:** Work **top-down** (easiest → hardest). Small slice → `npm run ci` → sync `.cursor/brain/` if trust model changes. Exploratory bullets need a **spec** before core code. When something ships, **remove** it from the backlog and add **one line** under Recently shipped.

## Backlog (real difficulty: easiest → hardest)

1. **Batch URLs** — orchestrate multiple **watch URLs** in **one CLI run** (read list from file or stdin), call **`prepare` sequentially** (same pattern as **sequential `--sub-langs`**: avoid parallel hammering, optional **delay ms** / **max count**). Playlists as a **later** slice (yt-dlp surface, higher scraping/ToS risk).

2. **Optional summary shapes** and **handoff density** for a **second-hop LLM** (stronger BLUF, **extractable facts** — versions, names, dates — in the existing handoff subsections when the transcript is dense) — aligned changes to `prompts/video-notes-prompt.md`, `outputLanguage.ts`, `summaryContract.ts`, tests. **Harder than batch** because every change touches the **published contract** agents rely on. (Purely **tooling** improvements to subtitle ranking / Whisper path stay in the existing transcript-quality harness unless promoted here.)

3. **Claim verification / fact-fetch (exploratory)** — optional evidence pass; spec before code; must not replace the canonical URL → transcript → summary → `agent:check-summary` path. **Network + trust + labeling**; easier to get wrong than batch.

4. **Multimodal / key-frame context (exploratory)** — speech + on-screen context; **ffmpeg**, artifact layout, optional manifest fields; spec before implementation. **Depends on disk video + tooling**; keep core path working without it.

5. **Searchable archive / semantic retrieval** — **new indexing/storage layer** and retrieval policy; orthogonal to “one video folder” workflow.

6. **UI or browser extension** — **largest surface**; separate product from CLI moat.

## Why this order (critique of the old list)

- **Previously, “optional summary shapes” was first** — that is **not** the lightest step: it forces **cross-cutting** edits (prompt + validator + presets) and high **regression** risk on every summary file in the wild.
- **Batch URLs**, if scoped as **sequential prepare + limits**, mostly adds **CLI glue** and reuses existing **`prepareAgentWorkflow`** — **lower blast radius** than contract changes. **Regression discipline:** mirror **sequential** I/O (like subtitle language attempts), avoid unbounded parallelism against YouTube/yt-dlp.
- **Exploratory items (3–4 in the new list)** stay below **archive** and **UI**: they need specs, but are still **narrower** than building a **retrieval product** or a **full UI**.
- **When time is limited**, prioritize **item 2** (summary quality for the **next model / reader**) over **item 1** (batch convenience) unless you are processing many URLs.

## Non-goals

All-in-one YouTube toolkit, cloud summarizer as default, large-scale channel scraping, major UI before core workflow is mature.

---

**Recently shipped:** subs pipeline (sequential langs, 429 retry, Whisper preflight); README env/manifest table; stderr hints on failed `agent:complete` / `agent:check-summary`; Cyrillic transcript-quality fixtures; external benchmark doc + golden IDs; `cursor-handoff.md` + `cursorHandoffPath`; **description vs transcript YAML** — heuristic omission + `YT_TRANSCRIPT_DESC_ALIGN_*` / `--desc-align-*` + `videoDescriptionAlignmentPolicy` in manifest; **product intent** (why / second-hop handoff) in `PROJECT_CONTEXT.md`, README, and `CLAUDE.md`.
