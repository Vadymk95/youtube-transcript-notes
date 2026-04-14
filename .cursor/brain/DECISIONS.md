# Architectural Decisions

## [2026-04] Verification hints file + optional ffmpeg key frames in `agent:prepare`

**Decision**: After `runPipeline`, **`prepareAgentWorkflow`** may write **`verification-hints.md`** (http(s) URLs from page description + spaced transcript anchors; **no network I/O**) unless disabled via **`verificationHints: false`** or **`YT_TRANSCRIPT_VERIFICATION_HINTS=0`**. When **`keyFrames: true`** or **`YT_TRANSCRIPT_KEY_FRAMES=1`**, download merged video with **`downloadMergedVideo`**, extract JPEGs under **`keyframes/`** via **`extractKeyFrameStills`** (`ffmpeg`), delete temp video. **`summary-prompt.md`** gains **`{{SUPPLEMENTARY_CONTEXT}}`** pointing at those artifacts. **`manifest.json`** may include **`verificationHintsPath`** and **`keyFrames`** `{ enabled, directory, files, timesSec }`.

**Why**: Implements roadmap focus on denser second-hop context, lightweight “fact anchors,” and on-screen signal without requiring a vision model in-repo.

**Trade-off**: Key frames duplicate yt-dlp load and depend on disk; verification hints use naive URL regex (not full RFC 3986).

---

## [2026-04] Roadmap maintainer priorities (denser handoff, fact-fetch, frames)

**Decision**: Treat **`docs/technical-debt-roadmap.md`** **Current focus** as the live priority: implement **denser second-hop handoff** (prompt + `outputLanguage` + `summaryContract`) and **claim verification / fact-fetch** only with a written spec and without replacing the canonical prepare → summary → validate path. **Batch URL orchestration** stays **deferred**. **ffmpeg**-based **timecoded stills** (from transcript cue times or sparse sampling) plus optional vision/multimodal **review hints** are the intended shape of multimodal work; they remain **optional** and **off** by default so the core pipeline works without downloaded video.

**Why**: Matches product need for accuracy and on-screen grounding without forcing parallel URL hammering or cloud dependencies.

**Trade-off**: More moving parts (disk, vision CLI or API choice, labeling policy); requires explicit trust boundaries in the spec.

---

## [2026-04] Documentation index and grounding vs modalities narrative

**Decision**: Maintain **`docs/README.md`** as the canonical **index** of all files under `docs/` (grouped by audience). Add **`docs/grounding-limits-and-future-modalities.md`** to explain (1) layers that improve **accuracy** vs **shape**, (2) that **`agent:check-summary`** validates structure, not factual truth, (3) **transcript-only** limits for on-screen detail and how that ties to roadmap items **2** (denser handoff), **4** (multimodal), and **6** (UI/extension). Cross-link from **`docs/technical-debt-roadmap.md`**, **`CONTRIBUTING.md`**, root **`README.md`**, and **`MAP.md`**.

**Why**: Reduces “docs feel messy” without deleting cross-repo process files; makes the **UI/screenshot gap** explicit next to the product contract.

**Trade-off**: When the summary contract or backlog changes, update the grounding doc or index in the same PR when behavior or priorities shift.

---

## [2026-04] Page description vs transcript (YAML omission heuristic)

**Decision**: After subtitle/Whisper segments are built, **`assessVideoDescriptionAlignment(pageDescription, plainTranscript, thresholds)`** scores token overlap (URLs stripped, English stop words dropped). When **`descriptionAlignment.policy`** is **`heuristic`**, the page description is long enough, and overlap is below the configured minimum, **`runPipeline`** omits **`description`** from **`transcript.md`** front matter only. **`policy: always_include`** keeps YAML description regardless of overlap (lexical metrics stay honest). Thresholds and policy resolve from **`YT_TRANSCRIPT_DESC_ALIGN_*`** and optional **`--desc-align-*`** flags (CLI patch merges over env). **`PipelineResult.meta.description`** and **`manifest.json` `videoDescription`** still hold the full yt-dlp text. The manifest stores **`videoDescriptionAlignment`**, **`videoDescriptionAlignmentPolicy`**, **`videoDescriptionLexicalOverlap`**, **`videoDescriptionTokenCount`**, **`videoDescriptionOmittedFromTranscriptYaml`**.

**Why**: YouTube often reuses the description field for unrelated channel promos; embedding that in the prompt via `transcript.md` nudges summarizers away from the spoken content. Tunable defaults avoid a permanent TypeScript fork for different corpora.

**Trade-off**: False positives/negatives remain possible across languages and thin transcripts; the heuristic is lexical, not semantic. Operators should still treat **`videoDescription`** as non-factual context when **`videoDescriptionAlignment` === `low`**.

---

## [2026-04] Guided Cursor handoff file after `agent:prepare`

**Decision**: **`prepareAgentWorkflow`** writes **`cursor-handoff.md`** next to the canonical bundle, with absolute paths and a suggested **`agent:check-summary`** invocation. **`manifest.json`** includes **`cursorHandoffPath`**. Content is built by **`buildCursorHandoffMarkdown()`** (English markdown). Rollback on prepare failure removes this file too.

**Why**: Satisfies roadmap “guided summarizer” without bundling a remote model or **`YT_SUMMARY_CMD`**; primary UX stays Cursor chat + transcript grounding.

**Trade-off**: Another artifact to keep in sync with rules/docs; handoff is **not** validated by **`agent:check-summary`** (the summary file remains the contract).

---

## [2026-04] CLI trust boundaries: YouTube URL allowlist, safe video ids, quoted shell args

**Decision**: **`transcriptCli`**, **`agentWorkflowCli`**, and **`agentCompleteCli`** call **`assertYoutubeWatchUrl`** by default (http/https + hostname in `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`). **`YT_TRANSCRIPT_ALLOW_ANY_URL`** (`1` / `true` / `yes`) or **`--allow-any-url`** skips the hostname check for power users and tests. **`parseVideoInfoFromDumpJson`** always runs **`assertSafeVideoIdForPath`** on the trimmed id before returning **`VideoInfo`**. Whisper and summary shell templates substitute placeholders with **`quoteForPosixShSingle`** so paths and `VIDEO_ID` cannot break out of a single `sh -c` word without newlines/NUL. **`agent:check-summary`** accepts optional **`--artifacts-root`** to reject summary paths outside a resolved directory.

**Why**: Aligns runtime with “YouTube URLs only” product scope while keeping a documented escape hatch; closes directory traversal via malicious ids; reduces shell injection from path-shaped data; limits arbitrary reads when the validator is automated.

**Trade-off**: **`YT_SUMMARY_CMD` / `--summary-cmd` recipes must not wrap `{{…}}` in extra double quotes** (each placeholder is already quoted). Operators who relied on `cat "{{PATH}}"` must switch to `cat {{PATH}}`.

---

## [2026-04] `agent:complete` uses user shell for summarization

**Decision**: **`npm run agent:complete`** runs **`prepareAgentWorkflow`**, then **`YT_SUMMARY_CMD`** (or **`--summary-cmd`**) via `sh -c` with path placeholders, then **`validateSummary`**. **`--prepare-only`** skips the shell and is the default CI-friendly path. No cloud API is bundled.

**Why**: Roadmap “one command” without breaking local-first policy; mirrors the existing Whisper command pattern.

**Trade-off**: Users must supply a working local CLI; complex templates (pipes, subshells) remain the operator’s responsibility. Path-shaped placeholders are shell-quoted; arbitrary shell syntax in the template can still be dangerous if misconfigured.

---

## [2026-04] Runtime summary language via env and CLI

**Decision**: Active output preset is **`resolveSummaryOutputLanguage(override)`** with precedence: `prepareAgentWorkflow({ replyLanguage })` or CLI `--reply-lang`, then **`YT_SUMMARY_LANG`**, then default **`ru`**. Built-in presets live in **`SUMMARY_LANGUAGE_PRESETS`** (`ru`, `en`). Validator accepts the same override so headings match the written summary.

**Why**: Roadmap P0 asked for language selection without editing TypeScript for end users; maintainers still add locales by extending the preset map.

**Trade-off**: New languages require a code change (or a future file-based loader); script detection uses a simple regex per preset (Cyrillic vs Latin), not full locale detection.

---

## [2026-04] MIT license for OSS readiness

**Decision**: Ship the project under the **MIT License** (`LICENSE` at repo root, `license` field in `package.json`).

**Why**: The project roadmap treats a public license as part of the OSS baseline; MIT is a common default for small developer tools and keeps reuse friction low.

**Trade-off**: Patent and liability terms are minimal compared to Apache-2.0; change only if the maintainer needs stricter patent grant language.

---

## [2026-04] Local transcript workflow is the default integration

**Decision**: The default agent integration is the local CLI workflow, not a custom MCP server and not a remote summarization API.

**Why**: The repository already has a reliable local path for subtitles and Whisper fallback. Reusing it keeps the behavior transparent, debuggable, and consistent with the repo's purpose.

**Trade-off**: Agent automation depends on local tools being installed and on repo rules being followed.

---

## [2026-04] Transcript-first summarization

**Decision**: The agent must summarize only after a transcript has been generated by the local pipeline.

**Why**: Summarizing from the title, URL, or assumptions is unreliable and violates the intended workflow.

**Trade-off**: One extra local step before the final answer, but much higher factual grounding.

---

## [2026-04] Single artifact bundle per video

**Decision**: The canonical bundle under `artifacts/videos/<videoId>/` contains `transcript.md`, `summary-prompt.md`, `summary.<replyLanguage>.md`, `manifest.json`, and `cursor-handoff.md` (the last is written by `prepareAgentWorkflow`; the summary file is completed by the chat step).

**Why**: The user-facing workflow requires a persisted handoff summary artifact, not just a prompt for another model. The filename now reflects the configured reply language code.

**Trade-off**: The workflow now has one more required artifact and needs validation to ensure the stored summary matches the expected structure.

---

## [2026-04] Ralph Method for summary verification

**Decision**: The final summary must pass a structural validator before the workflow is considered complete.

**Why**: A raw transcript and prompt are not enough; the final deliverable must be structured, aligned with the configured output language, and useful for the next AI agent without manual inspection.

**Trade-off**: The agent must loop: write summary, validate, rewrite if needed.

---

## [2026-04] Summary template authority vs machine checks

**Decision**: Human/model instructions for the final markdown live in **`prompts/video-notes-prompt.md`** plus the injected block from **`renderPromptRequiredOutputFormat()`** (`src/summary/outputLanguage.ts`). The **Ralph gate** is **`validateSummary()`** in **`src/summary/summaryContract.ts`**: exact `requiredHeadings` and `requiredHandoffSubheadings`, script heuristic (Cyrillic vs Latin), non-empty topic (min length), numbered outline section, bulleted main ideas, no `{{TRANSCRIPT}}`, speculative markers only inside gaps and risks bodies.

**Why**: The prompt can ask for richer behavior (e.g. 5–12 outline points); the validator enforces a **minimal structural contract** so `agent:check-summary` stays predictable and fast.

**Trade-off**: A summary can pass validation but still be a weak handoff; quality remains transcript + model + iteration, while the validator prevents broken structure.

---

## [2026-04] Prompt-level BLUF and outline/ideas split

**Decision**: The injected `REQUIRED_OUTPUT_FORMAT` and `video-notes-prompt.md` instruct a **BLUF-first** topic paragraph, a **chronological numbered outline**, **synthetic bullet ideas** (non-duplicative of the outline), explicit **reading-order** guidance for humans, and speculative markers **only** in the gaps section and handoff **risks** subsection—matching `validateSummary()`.

**Why**: Reduces skim time and Ralph failures from contradictory “ambiguity section only” wording while keeping the same validated headings.

**Trade-off**: Stronger instructions may slightly increase model adherence variance; the validator still enforces only structure, not prose quality.

---

## [2026-04] Russian is the default reply language

**Decision**: The project-level default summary output is Russian.

**Why**: The repo exists to produce concise Russian handoff notes from YouTube videos.

**Trade-off**: Supporting another language still requires translating headings, ambiguity fallback, and script checks, but now that work is centralized in `src/summary/outputLanguage.ts` instead of being spread across prompt, validator, and artifact naming.

---

## [2026-04] Roll back partial agent artifacts on `prepare` failure

**Decision**: If `prepareAgentWorkflow()` throws after writing bundle files in that invocation, delete `transcript.md`, `summary-prompt.md`, `manifest.json`, and `cursor-handoff.md` that were written in the same run. Do not delete the final summary file (user-owned).

**Why**: Avoids leaving a folder with a transcript but no manifest or prompt, which would confuse the agent contract.

**Trade-off**: A failed run removes work that could have been inspected for debugging; users can re-run `agent:prepare` or use `YT_TRANSCRIPT_DEBUG` / pipeline flags to debug earlier stages.

---

## [2026-04] Bounded default for yt-dlp `--sub-langs`

**Decision**: Manual and auto subtitle downloads use a short default language list (`en,en-US,en-orig,ru,uk,-live_chat`) instead of `all,-live_chat`.

**Why**: Requesting all auto-caption languages triggers hundreds of HTTP calls and often returns HTTP 429 from YouTube, which made the pipeline fall through to Whisper unnecessarily.

**Trade-off**: Videos whose only useful captions are outside the default list need `YT_TRANSCRIPT_SUB_LANGS` expanded (or `all` if the user accepts the risk).

---

## [2026-04] Validation failures: JSON on stdout, hints on stderr

**Decision**: `agent:check-summary` keeps **one JSON object on stdout** for machine use. When validation fails, it also prints a **multiline hint block on stderr** (`formatSummaryValidationHints`) with the active preset, a copy-paste `agent:check-summary` line, and error-specific tips. **`agent:complete`** follows the same pattern for `SummaryValidationFailedError` and includes `replyLanguage` in the JSON envelope.

**Why**: Roadmap P0 asked for in-flow guidance without breaking JSON consumers or changing the validator contract shape on stdout.

**Trade-off**: Operators must know to read stderr for hints; scripts should rely on exit code + stdout only.

---

## [2026-04] Sequential subtitle attempts, 429 retry, and Whisper preflight

**Decision**: `downloadManualSubs` / `downloadAutoSubs` call yt-dlp once per **positive** language in `YT_TRANSCRIPT_SUB_LANGS` (default list preserved), appending shared exclusions (e.g. `-live_chat`) each time. If the list contains **`all`**, a single combined `--sub-langs` request is used. After an attempt fails with HTTP **429**, the same language is retried once after **`YT_TRANSCRIPT_SUB_429_RETRY_MS`** (default 3500 ms; invalid or non-finite values fall back to 3500). Before **`downloadAudio`** on the Whisper path, **`assertWhisperCommandResolvable()`** validates the first simple token of the whisper template (PATH or file path); pipes, `sh -c`, or leading `{{` placeholders skip the check.

**Why**: Roadmap P0 — fewer burst 429s than one multi-language subtitle request, clearer failure before expensive audio work when Whisper is not installed.

**Trade-off**: More yt-dlp processes when the first languages produce no VTT files; operators with exotic whisper shell wrappers do not get automatic binary discovery.

---

## [2026-04] Video metadata via `yt-dlp --dump-single-json`

**Decision**: `fetchVideoInfo()` uses `--dump-single-json` (not separate `--print` lines) and exposes **`description`** alongside `id` and `title`.

**Why**: The YouTube description often contains links, chapters, and sponsor notes that never appear in captions. JSON avoids multiline `--print` ambiguity for titles/descriptions.

**Trade-off**: One larger metadata fetch per prepare run; descriptions can be long and grow `transcript.md` / model context. The field is omitted from YAML when empty.

---

## [2026-04] Collapse rolling auto captions only

**Decision**: After parsing WebVTT from `subtitle-auto`, run `collapseRollingAutoCaptions()` to merge consecutive cues whose text extends the previous cue by prefix, then trim or drop repeated leading text from neighboring sliding-window cues by suffix-prefix overlap. Do not apply to `subtitle-manual` or Whisper.

**Why**: YouTube auto-generated VTT uses both rolling/live-style prefix growth and sliding windows where the next cue drops the beginning of the phrase but keeps a long overlapping tail. Prefix-merge removes direct growth chains; overlap trimming produces a more readable transcript than aggressively merging whole windows into long paragraphs. Manual tracks rarely follow that pattern, and applying overlap heuristics outside auto-captions would risk incorrectly altering distinct utterances.

**Trade-off**: Conservative overlap thresholds reduce duplicates, but edge cases can still leave some redundant lines or, if thresholds are loosened too far, trim legitimate repeated phrasing across sentence boundaries.

---

## [2026-04] Manifest transcript character metrics

**Decision**: `manifest.json` written by `prepareAgentWorkflow()` includes `transcriptFileChars` and `transcriptBodyChars` (JavaScript string lengths, UTF-16 code units) derived from `transcript.md`.

**Why**: There is no in-repo maximum video duration; the practical limit for the summary step is model context. Exposing counts lets agents and humans estimate fit before loading `summary-prompt.md`.

**Trade-off**: Counts are not token counts and not grapheme-accurate for all Unicode; they are a cheap, stable signal only.

---

## [2026-04] Transcript quality harness gates caption cleanup changes

**Decision**: Caption-cleanup iterations should be accepted only when `npm run eval:transcript-quality` passes on protected and improvement fixtures, in addition to normal repo verification.

**Why**: Auto-caption cleanup is heuristic-heavy and easy to overfit to one video. A fixture-based harness gives a bounded autoresearch/evaluation loop with explicit keep-or-reject signals instead of intuition-only tuning.

**Trade-off**: The harness itself can become stale or too narrow. Fixtures and thresholds need periodic review as new failure modes appear.
