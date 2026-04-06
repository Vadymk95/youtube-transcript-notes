# youtube-transcript-notes

Small **Node.js + TypeScript CLI** for turning a **YouTube URL** into a transcript, plus an **agent-friendly workflow** for Cursor or Claude Code chats where you paste a YouTube link and get a ready-to-use summary artifact bundle.

## Why this exists

**Intent:** Turn long tech video into **fast, trustworthy signal** — updates, facts, and ideas — without watching the full runtime. The pipeline produces a **structured summary** grounded in a **local transcript**, validated by `agent:check-summary`, so you can **hand the file to another LLM or a human** for the next step (e.g. “is this relevant to our stack?”). **Local-first** extraction is the trust anchor; optional SaaS or hosted APIs are a separate layer, not the core idea.

## Quick start

### Cursor / Claude Code

1. Clone the repo and install dependencies:

```bash
git clone <your-fork-or-this-repo-url>
cd youtube-transcript-notes
npm install
```

2. Make sure the local runtime tools are available:

- `yt-dlp`
- `ffmpeg`
- optional local Whisper CLI for the fallback path

3. Open the repo in **Cursor** or **Claude Code**.
4. Paste a YouTube URL in chat and ask for notes, a summary, or a plan.
5. The intended local workflow is:

- run `npm run agent:prepare -- "<url>"`
    - optionally open `cursor-handoff.md` for absolute paths + a copy-paste `agent:check-summary` line
    - read `manifest.json` and `summary-prompt.md`
    - write the final summary artifact
    - validate it with `npm run agent:check-summary -- "<summary-file>"`

Artifacts are written under:

```text
artifacts/videos/<videoId>/
  transcript.md
  summary-prompt.md
  summary.<replyLanguage>.md
  manifest.json
  cursor-handoff.md
```

Default output language is Russian, so the default summary file is `summary.ru.md`.

### Defaults and environment (quick reference)

| Variable / flag                                   | Role                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transcript **`md`** (default) vs **`txt`**        | CLI: `--format md` or `--format txt`.                                                                                                                                                                                                                                                                                                                                                            |
| `YT_TRANSCRIPT_SUB_LANGS`                         | Comma list for yt-dlp `--sub-langs` (default a short set; avoid `all` unless you accept 429 risk). Fetched **one language at a time** with exclusions (e.g. `-live_chat`) appended per attempt.                                                                                                                                                                                                  |
| `YT_TRANSCRIPT_SUB_429_RETRY_MS`                  | Wait time before **one retry** of the same language after HTTP **429** (default `3500`; `0` = retry immediately, no sleep). Invalid or non-numeric values fall back to `3500`.                                                                                                                                                                                                                   |
| `YT_SUMMARY_LANG` / `--reply-lang`                | Summary preset (`ru`, `en`). CLI overrides env.                                                                                                                                                                                                                                                                                                                                                  |
| `YT_SUMMARY_CMD` / `--summary-cmd`                | Optional shell for `agent:complete` (headless / CI; primary path is the editor agent after `agent:prepare`).                                                                                                                                                                                                                                                                                     |
| `YT_TRANSCRIPT_WHISPER_CMD` / `--whisper-cmd`     | Whisper fallback template (`{{audio}}`, `{{outdir}}`). Values are **POSIX-quoted** for `sh -c` — use **bare** placeholders in the template (no extra `"..."` around them). **Preflight**: first token checked on PATH (or path exists) before audio download when Whisper is needed.                                                                                                             |
| `YT_TRANSCRIPT_ALLOW_ANY_URL` / `--allow-any-url` | Skip YouTube-only hostname allowlist on transcript/agent CLIs (non-YouTube extractors). Video id is still validated after metadata fetch.                                                                                                                                                                                                                                                        |
| `YT_TRANSCRIPT_DESC_ALIGN_*` / `--desc-align-*`   | Tune YAML **`description`** omission: **`YT_TRANSCRIPT_DESC_ALIGN_POLICY`** (`heuristic` \| `always_include`, aliases `on`/`off`/`include`); **`YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP`** (0–1]; **`YT_TRANSCRIPT_DESC_ALIGN_MIN_TOKENS`**; **`YT_TRANSCRIPT_DESC_ALIGN_MIN_CHARS`**. **`yt-transcript`** and **`agent:prepare`**: **`--desc-align-policy`**, **`--desc-align-min-overlap`**, etc. |
| `manifest.json`                                   | Read **`transcriptFileChars`**, **`transcriptBodyChars`**, **`videoDescription`**, alignment fields (**`videoDescriptionAlignment`**, **`videoDescriptionAlignmentPolicy`**, overlap/token counts, **`videoDescriptionOmittedFromTranscriptYaml`**), and **`cursorHandoffPath`**.                                                                                                                |

### CLI only

```bash
npm run dev -- "https://www.youtube.com/watch?v=VIDEO_ID"
# or after build
node dist/cli/transcriptCli.js "<url>" -o ./notes.md
```

## What it does

1. Fetches **video metadata** (id, title, **description** from YouTube — full text is always in `manifest.json` as `videoDescription`; by default, if lexical overlap with the spoken transcript is very low, the YAML `description` line may be omitted from `transcript.md`. Override with **`YT_TRANSCRIPT_DESC_ALIGN_POLICY=always_include`** or **`--desc-align-policy always_include`**).
2. Fetches **manual subtitles** with [yt-dlp](https://github.com/yt-dlp/yt-dlp) (WebVTT).
3. If they are missing or too short, tries **auto-generated** captions.
4. If that still fails (or you pass `--force-whisper`), downloads **audio** and runs a **local Whisper** command you configure (default expects the `whisper` CLI).

Output:

- **`md`** — YAML front matter plus segments like `**[MM:SS]** text` (default).
- **`txt`** — plain text, no timestamps.
- **Agent workflow artifacts** — transcript, summary prompt, language-specific summary file, and manifest JSON under `./artifacts/videos/<videoId>/`.

## License, contributing, troubleshooting

- [LICENSE](LICENSE) — MIT
- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup and PR checklist
- [docs/troubleshooting.md](docs/troubleshooting.md) — yt-dlp, ffmpeg, Whisper, HTTP 429, env flags

## Requirements

- **Node.js** ≥ 20
- **yt-dlp** on `PATH` (optional override: `YT_DLP_BIN`)
- **ffmpeg** — needed when extracting audio for Whisper
- **Whisper** — only for the fallback path (e.g. [openai-whisper](https://github.com/openai/whisper) CLI)

## Setup

```bash
npm install
npm run build
```

## Usage

```bash
npm run dev -- "https://www.youtube.com/watch?v=VIDEO_ID"
# or
node dist/cli/transcriptCli.js "<url>" -o ./notes.md
```

### Agent workflow

```bash
npm run agent:prepare -- "https://www.youtube.com/watch?v=VIDEO_ID"
```

**Optional: end-to-end with a shell** (prepare → your command writes `summary.<lang>.md` → validate). For **Cursor and similar editors**, the usual path is `agent:prepare` and then the **chat agent** writes the summary from `summary-prompt.md`, not this hook.

```bash
export YT_SUMMARY_CMD='cat {{SUMMARY_PROMPT_PATH}} | your-cli > {{SUMMARY_OUT_PATH}}'
npm run agent:complete -- "https://www.youtube.com/watch?v=VIDEO_ID" --reply-lang ru
```

Use `--prepare-only` if you only want transcripts + prompt (no `YT_SUMMARY_CMD`). Placeholders: `{{SUMMARY_PROMPT_PATH}}`, `{{SUMMARY_OUT_PATH}}`, `{{TRANSCRIPT_PATH}}`, `{{VIDEO_ID}}`, `{{MANIFEST_PATH}}`, `{{ARTIFACT_DIR}}` — each is expanded to a **single POSIX-quoted shell word** (do not wrap them in extra `"..."` in your template). Optional `--attempts 2` retries the command when validation fails (non-deterministic generators).

**`YT_SUMMARY_CMD` recipe shapes** (adapt names/flags to your tool): pipe prompt into any stdin CLI → `cat {{SUMMARY_PROMPT_PATH}} | your-cli > {{SUMMARY_OUT_PATH}}`; file arguments → `your-cli -i {{SUMMARY_PROMPT_PATH}} -o {{SUMMARY_OUT_PATH}}`; run a small script → `node ./scripts/summarize.mjs {{SUMMARY_PROMPT_PATH}} {{SUMMARY_OUT_PATH}}`. On failure, `agent:complete` and `agent:check-summary` print **hint blocks** on stderr after the JSON (preset, re-check command, links to the prompt template).

Validation writes machine-readable JSON to **stdout**; human hints go to **stderr** so scripts can keep parsing stdout.

This command writes a stable artifact bundle for the agent:

- `artifacts/videos/<videoId>/transcript.md`
- `artifacts/videos/<videoId>/summary-prompt.md`
- `artifacts/videos/<videoId>/summary.<replyLanguage>.md`
- `artifacts/videos/<videoId>/manifest.json`
- `artifacts/videos/<videoId>/cursor-handoff.md` (guided checklist; optional to open)

It also prints the same paths and metadata as JSON to stdout. The intended flow is:

1. Generate transcript and prompt with `agent:prepare`.
2. Write the final summary to `summary.<replyLanguage>.md` (default: `summary.ru.md`).
3. Validate it with `npm run agent:check-summary -- "artifacts/videos/<videoId>/summary.<replyLanguage>.md"`.
4. If validation fails, rewrite the summary and validate again.
5. Keep the summary strictly grounded in the transcript. If a detail is missing, use the configured ambiguity fallback instead of guessing.

### Cursor chat workflow

Once this repo is open in Cursor, you can send the agent a YouTube link and ask for a summary or plan. The local rules in `.cursor/rules/` tell the agent to:

1. Run `npm run agent:prepare -- "<url>"`.
2. Read `manifest.json`, then `summary-prompt.md`.
3. Write the final handoff summary to `summary.<replyLanguage>.md`.
4. Run `npm run agent:check-summary -- "<summary-file>"`.
5. If validation fails, rewrite and re-check until it passes.

Useful flags: `--format txt`, `--force-whisper`, `--min-chars <n>`, `--audio-format m4a`, `--whisper-cmd 'whisper {{audio}} --output_dir {{outdir}}'`, `--keep-tmp`. See `npm run dev -- --help`.

Environment:

- `YT_SUMMARY_LANG` — summary output preset: `ru` (default) or `en`. Overridden by `--reply-lang` on `agent:prepare` / `agent:check-summary` / `agent:complete`.
- `YT_SUMMARY_CMD` — optional shell template for `agent:complete` (see **Agent workflow** above). Overridden by `--summary-cmd` for that run.
- `YT_TRANSCRIPT_SUB_LANGS` — comma-separated `--sub-langs` for yt-dlp manual and auto captions (default: `en,en-US,en-orig,ru,uk,-live_chat`). Positive languages are fetched **one at a time** (exclusions like `-live_chat` apply each attempt) to reduce burst 429s; `all` stays one combined request. Avoid `all` unless you accept many requests and higher 429 risk. Upgrading from **1.0.x**: if you relied on every language in one shot, set this explicitly (e.g. `all,-live_chat`).
- `YT_TRANSCRIPT_SUB_429_RETRY_MS` — milliseconds to wait before **one retry** of the same subtitle language after HTTP **429** (default `3500`; `0` means retry immediately without sleeping).
- `YT_TRANSCRIPT_WHISPER_CMD` — default Whisper shell template
- `YT_TRANSCRIPT_DEBUG` — log yt-dlp subtitle attempt failures to stderr (prefixed with `[yt-transcript]`)
- `NODE_DEBUG=yt-transcript:ytdlp` — same subtitle-attempt messages via Node `debuglog` (stderr)

## Repo layout

- `prompts/video-notes-prompt.md` — LLM prompt template with exact Russian output headings.
- `.cursor/brain/` — project memory for Cursor (`PROJECT_CONTEXT`, `MAP`, `SKELETONS`, `DECISIONS`, `DICTIONARY`).
- `.cursor/rules/` — local agent rules that enforce the transcript-first workflow.

### Model output language

The summary output defaults to **Russian** (`ru`).

**Without editing TypeScript** you can use English summaries:

```bash
YT_SUMMARY_LANG=en npm run agent:prepare -- "<youtube-url>"
# or
npm run agent:prepare -- "<youtube-url>" --reply-lang en
npm run agent:check-summary -- "artifacts/videos/<videoId>/summary.en.md" --reply-lang en
```

Built-in presets: **`ru`**, **`en`** (see `SUMMARY_LANGUAGE_PRESETS` in `src/summary/outputLanguage.ts`). Unknown codes fail fast with a clear error.

Override order: **`--reply-lang`** on the CLI, then **`YT_SUMMARY_LANG`**, then default `ru`.

To add a **new** language, extend `src/summary/outputLanguage.ts` (headings, ambiguity fallback, speculative markers, script check regex). Then rerun:

```bash
npm run ci
```

## Development

```bash
npm run test        # unit tests (Vitest)
npm run test:watch
npm run agent:check-summary -- "<summary-file>"
npm run agent:complete -- "<youtube-url>" --prepare-only
npm run eval:transcript-quality
npm run ci          # format:check, lint (0 warnings), typecheck, test, build, eval:transcript-quality
npm run verify      # same as ci
```

### Transcript quality harness

Use the built-in transcript quality harness before accepting caption-cleanup changes or running an external autoresearch loop:

```bash
npm run eval:transcript-quality
npm run eval:transcript-quality -- --fixture youtube-qku-opening
npm run eval:transcript-quality -- --language en
npm run eval:transcript-quality -- --tag real-world
npm run eval:transcript-quality -- --json
npm run eval:transcript-quality -- --json --compact
```

`--json --compact` omits `cleanedSegments` from the payload for smaller machine-readable output.

The harness evaluates the current `collapseRollingAutoCaptions()` behavior against a file-based fixture corpus under `fixtures/transcript-quality/`. A candidate should be rejected if any protected fixture regresses or if overlap / segment quality gates fail. Keep changes only when the fixture checks pass and the normal repo verification (`npm run ci`) stays green.

Optional **network** benchmark (yt-dlp vs this CLI vs ad-hoc npm tools): [docs/transcript-external-benchmark.md](docs/transcript-external-benchmark.md) and [`fixtures/benchmark-videos/manifest.json`](fixtures/benchmark-videos/manifest.json).

**Git hooks (Husky):**

- **pre-commit** — `lint-staged`: ESLint `--fix` + `--max-warnings 0` and Prettier on staged `src/**/*.ts` and selected config/docs.
- **pre-push** — full `npm run ci` with `CI=true` (entire tree: format, lint, types, tests, build).

Unit tests cover **WebVTT parsing**, **Markdown/plain output**, and **subtitle file scoring** (no `yt-dlp` / Whisper required). End-to-end runs still need those tools on your machine; smoke-test locally with a short video URL after `npm run build`.
