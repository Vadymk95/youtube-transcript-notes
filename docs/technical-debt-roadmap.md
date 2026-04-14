# Open backlog (technical debt)

**Only unfinished work.** When the list is empty, delete this file and remove links from `CONTRIBUTING.md`, `.cursor/brain/MAP.md`, and `docs/reliability-handoff-prompt.md`.

**Process:** Work **top-down** (easiest → hardest). Small slice → `npm run ci` → sync `.cursor/brain/` if trust model changes. Exploratory bullets need a **spec** before core code. When something ships, **remove** it from the backlog and add **one line** under Recently shipped.

**Context:** accuracy vs hallucination, **structured** handoff contract, and **transcript-only vs on-screen** limits — [grounding-limits-and-future-modalities.md](./grounding-limits-and-future-modalities.md).

## Current focus (maintainer priority — not the same as difficulty order)

- **Now:** (1) **denser handoff** (backlog item 1), (2) **fact-fetch / claim verification** (item 2, spec before code), (3) **timecoded frames** — extract stills with **ffmpeg** at transcript cue times (or a sparse grid), write paths under the video artifact bundle, optional **vision or multimodal** pass to label “worth human/model review” — extends item 3; keep the step **optional** and **local-first** by default (no cloud as required path).

## Backlog (real difficulty: easiest → hardest)

1. **Optional summary shapes** and **handoff density** for a **second-hop LLM** (stronger BLUF, **extractable facts** — versions, names, dates — in the existing handoff subsections when the transcript is dense) — aligned changes to `prompts/video-notes-prompt.md`, `outputLanguage.ts`, `summaryContract.ts`, tests. High **blast radius** because every change touches the **published contract** agents rely on. (Purely **tooling** improvements to subtitle ranking / Whisper path stay in the existing transcript-quality harness unless promoted here.)

2. **Claim verification / fact-fetch (exploratory)** — optional evidence pass; spec before code; must not replace the canonical URL → transcript → summary → `agent:check-summary` path. **Network + trust + labeling**; easier to get wrong than sequential `prepare`.

3. **Multimodal / key-frame context (exploratory)** — speech + on-screen context; **ffmpeg** extracts **frames at timecodes** derived from transcript segments (or fixed stride), stored next to the bundle; optional second step: small vision model or multimodal LLM to flag slides/code/UI worth cross-checking (pairs with **fact-fetch** for evidence labeling). **Depends on downloaded video + disk**; spec before implementation; core URL → transcript → summary path must run **without** this step.

4. **Searchable archive / semantic retrieval** — **new indexing/storage layer** and retrieval policy; orthogonal to “one video folder” workflow.

5. **UI or browser extension** — **largest surface**; separate product from CLI moat.

## Why this order (critique of the old list)

- **Previously, “optional summary shapes” was first** — that is **not** the lightest step: it forces **cross-cutting** edits (prompt + validator + presets) and high **regression** risk on every summary file in the wild.
- **Exploratory items (2–3 in the current list)** stay below **archive** and **UI**: they need specs, but are still **narrower** than building a **retrieval product** or a **full UI**.
- **When time is limited**, prioritize **denser handoff** (summary quality for the **next model / reader**) over convenience features unless you are blocked on throughput.

## Non-goals

All-in-one YouTube toolkit, cloud summarizer as default, large-scale channel scraping, major UI before core workflow is mature.

---

**Recently shipped:** **`agent:prepare --batch-file`** (sequential URLs from file or stdin, optional delay / max / continue-on-error); subs pipeline (sequential langs, 429 retry, Whisper preflight); README env/manifest table; stderr hints on failed `agent:complete` / `agent:check-summary`; Cyrillic transcript-quality fixtures; external benchmark doc + golden IDs; `cursor-handoff.md` + `cursorHandoffPath`; **description vs transcript YAML** — heuristic omission + `YT_TRANSCRIPT_DESC_ALIGN_*` / `--desc-align-*` + `videoDescriptionAlignmentPolicy` in manifest; **product intent** (why / second-hop handoff) in `PROJECT_CONTEXT.md`, README, and `CLAUDE.md`; **denser handoff prompt** (structured facts line format) + **`verification-hints.md`** + optional **`keyframes/`** (yt-dlp merged video + ffmpeg) + **`{{SUPPLEMENTARY_CONTEXT}}`** in `summary-prompt.md` (roadmap handoff density / fact-fetch / vision still future work).
