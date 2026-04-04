# Technical Debt And Product Roadmap

## Purpose

This document turns the current market and architecture analysis into a practical roadmap for `youtube-transcript-notes`.

Use it to answer:

- What is already strong and should be preserved
- What is real debt vs. optional polish
- What should be built next
- What should explicitly **not** be built yet
- How to prioritize work if the project moves toward a public open-source release

## Current Positioning

The project is strongest as a:

**Local-first, trustworthy YouTube transcript workflow for developers and AI agents**

It is **not** currently strongest as:

- a mass-market consumer summarizer
- a polished browser extension
- a bulk transcript scraping platform
- a broad “all-in-one YouTube utility suite”

That distinction matters. The roadmap below optimizes for the project's current strengths instead of chasing every adjacent market.

## What Is Already Strong

These are assets, not debt. Protect them.

- Transcript-first architecture instead of title-based or URL-based summarization
- Local-first pipeline with `yt-dlp` and optional Whisper fallback
- Canonical artifact contract:
    - `transcript.md`
    - `summary-prompt.md`
    - `summary.<replyLanguage>.md`
    - `manifest.json`
- Summary validation contract instead of “LLM output is whatever it is”
- YouTube auto-caption cleanup beyond raw VTT parsing
- Transcript quality harness with fixed fixtures and acceptance gates
- Clear separation of concerns across `pipeline`, `transcript`, `summary`, and `cli`
- Open-source friendly README and centralized summary output language config
- OSS contributor baseline: `LICENSE` (MIT), `CONTRIBUTING.md`, GitHub Actions CI (`.github/workflows/ci.yml`), issue templates, `docs/troubleshooting.md`
- Runtime summary language: `YT_SUMMARY_LANG`, `--reply-lang`, presets `ru` / `en` in `src/summary/outputLanguage.ts`
- Optional **`agent:complete`** loop: prepare + `YT_SUMMARY_CMD` + validation (`--prepare-only` without a model)
- Prepare-path resilience: **sequential** yt-dlp `--sub-langs` (one positive language per attempt; `all` stays one request), **one 429 retry** per language (`YT_TRANSCRIPT_SUB_429_RETRY_MS`), **Whisper preflight** before audio when the Whisper fallback runs (`src/pipeline/ytDlp.ts`, `src/pipeline/whisperFallback.ts`; README **Defaults and environment** table)

## Reliability handoff (YouTube 429, Whisper, description)

Real-world run: default multi-language subtitle fetch hit **HTTP 429**, then **Whisper** was not installed and the run failed. Narrowing `YT_TRANSCRIPT_SUB_LANGS` (e.g. to `ru`) avoided 429 for that video.

- **Prompt for another model / planner** (incident + roadmap alignment): [`docs/reliability-handoff-prompt.md`](./reliability-handoff-prompt.md)
- **Implemented:** `fetchVideoInfo` uses `yt-dlp --dump-single-json` so the **video description** is available in `transcript.md` front matter (`description`) and in `manifest.json` as **`videoDescription`** (links and notes from the YouTube page).
- **Implemented:** sequential subtitle fetches, 429 retry backoff, and Whisper preflight (see **What Is Already Strong** and `docs/troubleshooting.md`).
- **Still open (UX):** clearer, in-CLI hints when **`agent:complete`** or **summary validation** fails (e.g. suggested env flags), beyond static docs.

## Competitive Reality

The market is crowded, but fragmented.

### Lightweight transcript libraries

Examples:

- `youtube-transcript`
- `youtube-caption-extractor`
- Python transcript APIs and wrappers

They win on:

- low setup friction
- easy embedding in apps
- simple “URL -> transcript” workflows

They usually lose on:

- reliability at scale
- transcript cleanup quality
- artifact discipline
- summary validation

### Core extraction infrastructure

Examples:

- `yt-dlp`
- `whisper`
- `faster-whisper`

They win on:

- robustness
- local control
- portability

They do not solve:

- end-to-end note generation
- transcript cleanup heuristics for YouTube auto-captions
- structured handoff artifacts
- summary contracts

### SaaS and browser tools

Examples:

- NoteLM.ai
- YouTube transcript and summarizer web apps
- browser extensions with “paste URL -> summary”

They win on:

- instant UX
- breadth of features
- no local setup
- attractive product packaging

They usually lose on:

- local-first privacy guarantees
- reproducibility
- auditability
- artifact stability

### Creator and document repurposing tools

Examples:

- transcript-to-document products
- quiz generators
- searchable content-library products

They win on:

- user-facing value beyond raw transcript
- broader creator workflows

They often struggle with:

- YouTube extraction fragility
- scale-related blocking
- maintaining grounding to the source transcript

## Repeated User Pain In The Market

Across GitHub issues, Hacker News, Reddit, and product pages, the same pain points repeat:

- YouTube transcript extraction breaks or drifts over time
- auto-captions are noisy, repetitive, or wrong on names and technical terms
- incorrect language detection or bad translated subtitles
- hidden subscriptions, pricing traps, and cloud lock-in
- poor exports or missing timestamps
- summaries hallucinate details not present in the source
- tools work for short simple videos but degrade on long or messy ones
- users want privacy and local control, but do not want painful setup

## Main Gaps

These are the most important current gaps relative to the market and the repo’s own goals.

### P0: Productization gaps

These are the highest-value issues because users will feel them immediately.

#### 1. One-command UX is partial (local summarizer is still DIY)

Current state:

- **`npm run agent:complete`** chains prepare → optional **`YT_SUMMARY_CMD`** / **`--summary-cmd`** → **`validateSummary`**, with **`--prepare-only`** when no model is configured
- the summarizer is **user-provided shell** (local-first: no bundled cloud API)

Remaining gap:

- “Batteries included” summarization for users who will not wire `YT_SUMMARY_CMD`
- smarter **in-flow** guidance when validation or `agent:complete` fails (not only README / troubleshooting)
- more **README recipes** for real `YT_SUMMARY_CMD` patterns (quick-reference table for env defaults is already in README)

Non-goal:

- do not replace the canonical transcript-first workflow or make a remote API the default

### P1: Quality and trust gaps

These matter for long-term defensibility.

#### 2. Transcript quality fixture corpus is too small

Current state:

- harness exists, which is a major strength
- corpus is still narrow

Risk:

- cleanup logic can overfit current examples
- multilingual and real-world caption failure modes remain under-covered

Recommended direction:

- grow fixture corpus by language, domain, and failure pattern
- include:
    - technical talks
    - noisy podcasts
    - non-English lectures
    - mixed-language content
    - edge cases with sentence-boundary ambiguity

Acceptance signal:

- at least a small but representative multilingual corpus with protected fixtures and real-world fixtures

#### 3. No explicit benchmark against external alternatives

Current state:

- internal quality loops exist
- external market comparison is still qualitative

Why it matters:

- without a benchmark, it is hard to know whether a change improves the product in a market-relevant way

Recommended direction:

- define a fixed video set
- compare:
    - raw YouTube transcript access
    - `yt-dlp` alone
    - at least one npm transcript package
    - current project pipeline
- evaluate:
    - transcript cleanliness
    - duplication rate
    - usability for summary generation
    - setup friction

### P2: Feature gaps worth considering later

These may become important, but they are not the right first moves.

#### 4. No batch mode

Potential value:

- playlists
- channels
- multiple URLs
- research workflows

Why not now:

- bulk extraction shifts the project toward scraping scale problems
- YouTube blocking risk grows quickly
- single-video reliability is still more important

Recommendation:

- treat as post-v1 or power-user feature

#### 5. No search / content-library workflow

Potential value:

- searchable creator archives
- semantic retrieval
- study workflows

Why not now:

- this changes the product category
- transcript quality and chunking strategy would need another layer of design

Recommendation:

- only pursue after the single-video workflow is clearly strong and adopted

#### 6. No UI or extension

Potential value:

- lower friction
- better adoption

Why not now:

- large surface area increase
- distracts from core differentiation
- adds browser/runtime complexity

Recommendation:

- keep CLI and agent workflow as the primary interface through the next maturity stage

## What We Should Explicitly Not Build Now

These items are tempting, but they are likely distractions at the current stage.

- A broad “all-in-one YouTube toolkit” with comments, thumbnails, analytics, etc.
- A second default orchestration path through remote APIs or hosted summarization
- Playlist or channel scraping at scale as a primary direction
- A browser extension before the CLI workflow is stronger
- Speaker diarization and advanced semantic search before transcript reliability is stronger
- A large UI surface before open-source workflow and benchmark maturity improve

## Overhead To Watch

These are not immediate bugs, but they can become adoption drag.

### Good overhead

Keep this because it creates trust:

- artifact contract
- validator
- prompt/summary alignment
- quality harness
- transcript-first discipline

### Risky overhead

Reduce this only where it hurts users:

- local binary setup friction
- agent-specific workflow complexity for external users
- strict output contract without alternative output modes
- NodeNext/ESM/config sharp edges that create editor friction

## Strategic Recommendation

Do **not** try to out-feature broad SaaS competitors.

Instead, lean into:

- local-first privacy
- transcript trustworthiness
- explicit artifact contracts
- validation
- reproducible quality loops
- developer and AI-agent workflows

The best differentiator is:

**Reliable transcript-to-handoff workflow with measurable quality, not generic “AI video summaries.”**

## Suggested Roadmap

**Public OSS baseline is in place** (`LICENSE`, `CONTRIBUTING.md`, CI, issue templates, `docs/troubleshooting.md`). Treat further release polish (semver story, npm publish, marketing copy) as optional unless you are shipping broadly.

### Productize the current strengths

Priority: Highest

Goals:

- turn the current workflow into a smoother tool without changing its philosophy

Work items:

1. Improve one-command UX (guided defaults, clearer **in-CLI** failures) on top of `agent:complete`
2. Add optional output modes beyond the strict handoff summary:
    - handoff
    - short summary
    - outline
3. Expand README with **usage recipes** (especially `YT_SUMMARY_CMD` examples); env / manifest quick reference is already shipped

_(Prepare path: sequential `--sub-langs`, 429 retry, Whisper preflight, and the README env table are complete.)_

Why:

- this closes the biggest gap versus simpler competitors while preserving the trustworthy architecture

### Strengthen quality moat

Priority: High

Goals:

- make caption cleanup harder to beat

Work items:

1. Expand transcript quality fixtures
2. Add real-world multilingual benchmark set
3. Document regression criteria for caption-cleanup changes
4. Track before/after quality metrics for important iterations

Why:

- quality is one of the few areas where this project can defend a stronger position than transcript fetch libraries

### Evaluate expansion paths (carefully)

Priority: Medium

Goals:

- expand only where it aligns with the product identity

Candidate work items:

1. Batch mode for multiple URLs
2. Structured JSON output for downstream automation
3. Optional searchable archive workflow

Guardrails:

- do not pivot into large-scale scraping
- do not replace local-first defaults
- do not add major UI surface without user pull

## Priority Table

| Item                       | Priority | Why now                      | Why not later                           |
| -------------------------- | -------- | ---------------------------- | --------------------------------------- |
| One-command UX polish      | P0       | Biggest UX gap for lay users | Core loop exists via `agent:complete`   |
| Expand fixture corpus      | P1       | Protects cleanup quality     | Needed before wider usage               |
| External benchmark set     | P1       | Makes strategy measurable    | Prevents intuition-only decisions       |
| Batch mode                 | P2       | Useful, but not core yet     | Can wait until single-video UX is solid |
| Search / archive workflows | P2       | Promising adjacent category  | Too early and too broad                 |
| UI / extension             | P2       | Big adoption upside          | Too distracting right now               |

**Resolved (removed from table above):** subtitle 429 / sequential langs + Whisper preflight + README env quick-reference table (+ troubleshooting updates).

## Definition Of “Good Next Version”

The next strong milestone should satisfy all of the following:

- a new user can install dependencies and understand the workflow quickly
- a casual user can get a validated summary without hand-wiring shell (`YT_SUMMARY_CMD` today is power-user)
- CI remains green and quality fixtures cover more than the current narrow set

## Final Recommendation

If only a few things get built next, choose these:

1. One-command UX polish (clearer failures, optional non-shell summarizer path) — prepare-path hardening and README env table are **done**
2. Expanded quality fixture corpus
3. External benchmark set

Everything else should be judged against one question:

**Does this strengthen the project’s moat as a trustworthy local-first transcript workflow, or does it just make the product broader?**
