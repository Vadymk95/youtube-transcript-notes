# Open backlog (technical debt)

**Intent:** This file lists only **unfinished** work. When the list is empty, **delete this file** and remove links from `CONTRIBUTING.md`, `MAP.md`, and `docs/reliability-handoff-prompt.md`. Older market/strategy notes live in git history.

**How to use (walking order):** Work **P0 → P1 → P2** unless a lower item blocks you. For each bullet: implement the smallest slice → run **`npm run ci`** → if behavior or trust model changed, sync **`.cursor/brain/`** (`MAP.md`, `DECISIONS.md`, `SKELETONS.md` as needed) per repo rules. **Exploratory** items (long nested sections) need a **spec or agent playbook** before touching core code; they must keep the **canonical** path **URL → transcript → summary → `agent:check-summary`** unless the item explicitly extends the contract. When something ships, **remove or shorten** its bullet here and add a one-line note under **Recently shipped** (do not duplicate full specs in both places).

## P0 — productization

- **Bundled or guided summarizer** for users who will not write `YT_SUMMARY_CMD` (stay local-first; no remote API as default).
- **Optional summary shapes** beyond the strict handoff contract (e.g. short summary, outline) — requires aligned prompt + validator changes.
- **More README examples** for specific local CLIs (Ollama, etc.) if needed beyond the current recipe shapes + env table.

## P1 — quality moat

- Expand **transcript quality fixtures** (`fixtures/transcript-quality/`).
- **External benchmark** (fixed video set vs raw YouTube / `yt-dlp` alone / npm transcript helpers); document regression expectations.
- **Optional claim verification / fact-fetch pass (exploratory)** — treat `summary.<replyLanguage>.md` as **structured handoff**, not **ground truth** for factual news; **not started** (spec + recipe before code).
    - **Problem:** `agent:check-summary` enforces **contract shape** (headings, bullets, hedging rules), not **epistemic correctness**. The transcript and the model can inherit speaker mistakes, rumor, or misread cap tables; users may assume “validator passed” means “true”.
    - **Intent:** An **opt-in** stage (CLI flag, env, or documented agent playbook only at first) that **fetches independent evidence** for a short list of **checkable claims** (deals, dates, policy changes, numbers), then writes results in a **clearly labeled** place so “from video” vs “cross-checked” never blends silently.
    - **Pipeline sketch (Ralph-like, not a second orchestration layer by default):** (1) extract atomic claims from summary + transcript cues; (2) for each claim, **retrieve** primary or high-trust secondary sources (vendor blog, regulator filing, wire story); (3) **reconcile** — match / contradict / unknown; (4) **update artifact** — prefer a dedicated subsection (e.g. under **Пробелы и неоднозначности** / **Gaps and ambiguities**) or a sibling file e.g. `verification.<replyLanguage>.md` referenced from `manifest.json` **only if** we extend the contract; (5) **repeat** until stop rule (max iterations, or “all P0 claims resolved or explicitly flagged”). Agent tooling: **sequential decomposition** (e.g. MCP “think in steps”) for claim lists; **Context7** only where the claim is **library/API/doc-shaped** — it is a weak default for breaking news.
    - **Repo hygiene:** Keep the **canonical** path URL → transcript → summary → `agent:check-summary`; verification is an **optional fork** documented in `.cursor/brain/` + README when behavior exists — do not make network I/O mandatory for core local-first CLI.
    - **Risks / non-goals:** SEO spam and duplicate churn as “sources”; paywalls; rate limits; verification summaries that **invent** citations — require **URLs or quotable primary titles** in the verification artifact; no promise of legal-grade due diligence.
    - **Critique of this backlog item itself (so we do not overfit the plan):**
        - **Context7** is excellent for **framework/version facts**, poor for **headline velocity** — the write-up must not present it as the main fact-check engine for news.
        - **“Ralph”** here is only an analogy (iterate until a criterion); without a **machine-checkable** stop condition (e.g. max claims, required citation fields), the loop becomes vague busywork.
        - Mixing externally verified sentences into **Главные идеи** / **Main ideas** without labels **pollutes** the “transcript-only” contract — safer to quarantine cross-check results in **gaps**, **risks**, or a **separate file** until the prompt + validator explicitly allow dual attribution.
        - Full automation of “truth” is **not** a realistic P1 outcome; the valuable increment is **transparent, optional** human-in-the-loop or agent-assisted **evidence pointers**, not a second truth oracle.

## P2 — later

- Batch URLs / playlists (power-user; watch scraping risk).
- Searchable archive / semantic retrieval workflow.
- UI or browser extension.
- **Optional multimodal / key-frame context (exploratory)** — **full-picture** summaries (speech + on-screen UI/slides) without making the core CLI depend on any single LLM vendor; **not started** (weigh pros/cons before coding). **Rationale for P2:** depends on Cursor agent UX, optional contract extensions, and video-on-disk workflow — **not** part of the core transcript/summary moat until the text path is boringly solid.
    - **Problem:** transcript-only handoffs miss what is **shown**; analyzing every frame is too expensive.
    - **Preferred orchestration (maintainer / Cursor use case):** keep **vision inside Cursor** — user runs **`agent:prepare`** (or equivalent) so `transcript.md`, `summary-prompt.md`, and **`manifest.json` (code-generated today)** exist; the **Cursor agent** reads the transcript, proposes **high-value timestamps** (demos, settings, slides), runs **`ffmpeg`** via terminal to write stills under e.g. `artifacts/videos/<videoId>/frames/`, then runs a **second multimodal pass** with the **same Cursor model (auto or pinned)** so images land in chat context. **Final summary** merges **transcript + frame observations** (workflow doc / optional prompt template — not mandatory cloud).
    - **Repo responsibility vs IDE:** this repository should stay **deterministic** where possible: optional CLI to **extract frames from a local video + timestamp list** (file or stdin), optional **manifest fields** later (e.g. `framePaths[]`, `visualInterestSec[]`) if we extend the contract; it should **not** try to “call Cursor’s model” from Node. **Epistemic split:** code-generated `manifest.json` stays truthy for paths/metrics; any **LLM-produced** schedule of timestamps should live in a **sibling artifact** (e.g. `frames-plan.json`) or agent thread until we explicitly merge schemas.
    - **Implementation difficulty:** **medium** — `ffmpeg` integration + artifact layout + tests (mock `ffmpeg`); docs for the **two-pass agent playbook** (text triage → extract → attach/`@` frames → multimodal summary). **Cursor caveat:** verify on your Cursor build whether the agent **automatically** multimodal-reads images from disk paths; if not, the playbook must require **explicit attachment** or `@`-references so the chosen vision model actually sees pixels.
    - **Cheapest / most effective for this repo:** **$0 extra npm deps**; **`ffmpeg` via existing `runCmd` / `execFile`**. **Frame policy:** (1) **transcript-aligned** samples around segments the agent (or heuristics) flags; (2) **uniform backup** every N seconds for silent slides; (3) optional **scene-change** sampling later (e.g. PySceneDetect — defer).
    - **Alternatives (optional, not the default story here):** fully offline **Ollama / LM Studio** vision from the shell for users who never want editor-tied models — document as an **opt-in** recipe only; same for third-party multimodal APIs if someone wires `YT_SUMMARY_CMD`-style hooks to a vision endpoint.
    - **Similar OSS reference:** [`jdmonaco/ytcapture`](https://github.com/jdmonaco/ytcapture) — yt-dlp + ffmpeg, interval frames, transcript-aligned notes (prior art for frame cadence; our artifact contract stays explicit).
    - **Risks / non-goals:** YouTube ToS + disk for video files; variable vision quality; never block core transcript path if video/`ffmpeg` missing — **strictly optional** flags/env and clear skip behavior.

## Non-goals (unchanged)

- All-in-one YouTube toolkit, cloud summarizer as default, large-scale channel scraping, major UI before core workflow is mature.

---

**Recently shipped (do not re-list above):** sequential `--sub-langs` + 429 retry + Whisper preflight; README env/manifest quick reference; **stderr hint blocks** after failed `agent:complete` / `agent:check-summary` (`src/summary/summaryValidationHints.ts`).
