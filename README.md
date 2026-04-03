# youtube-transcript-notes

Small **Node.js + TypeScript CLI** for turning a **YouTube URL** into a transcript, plus an **agent-friendly workflow** for Cursor or Claude Code chats where you paste a YouTube link and get a ready-to-use summary artifact bundle.

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
```

Default output language is Russian, so the default summary file is `summary.ru.md`.

### CLI only

```bash
npm run dev -- "https://www.youtube.com/watch?v=VIDEO_ID"
# or after build
node dist/cli/transcriptCli.js "<url>" -o ./notes.md
```

## What it does

1. Fetches **manual subtitles** with [yt-dlp](https://github.com/yt-dlp/yt-dlp) (WebVTT).
2. If they are missing or too short, tries **auto-generated** captions.
3. If that still fails (or you pass `--force-whisper`), downloads **audio** and runs a **local Whisper** command you configure (default expects the `whisper` CLI).

Output:

- **`md`** — YAML front matter plus segments like `**[MM:SS]** text` (default).
- **`txt`** — plain text, no timestamps.
- **Agent workflow artifacts** — transcript, summary prompt, language-specific summary file, and manifest JSON under `./artifacts/videos/<videoId>/`.

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

This command writes a stable artifact bundle for the agent:

- `artifacts/videos/<videoId>/transcript.md`
- `artifacts/videos/<videoId>/summary-prompt.md`
- `artifacts/videos/<videoId>/summary.<replyLanguage>.md`
- `artifacts/videos/<videoId>/manifest.json`

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

Useful flags: `--format txt`, `--force-whisper`, `--min-chars <n>`, `--audio-format m4a`, `--whisper-cmd "<shell with {{audio}} and {{outdir}}>"`, `--keep-tmp`. See `npm run dev -- --help`.

Environment:

- `YT_TRANSCRIPT_SUB_LANGS` — comma-separated `--sub-langs` for yt-dlp manual/auto captions (default: `en,en-US,en-orig,ru,uk,-live_chat`). Avoid `all` unless you accept many requests and possible HTTP 429 from YouTube. Upgrading from **1.0.x**: if you relied on every language being fetched, set this explicitly (e.g. `all,-live_chat`).
- `YT_TRANSCRIPT_WHISPER_CMD` — default Whisper shell template
- `YT_TRANSCRIPT_DEBUG` — log yt-dlp subtitle attempt failures to stderr (prefixed with `[yt-transcript]`)
- `NODE_DEBUG=yt-transcript:ytdlp` — same subtitle-attempt messages via Node `debuglog` (stderr)

## Repo layout

- `prompts/video-notes-prompt.md` — LLM prompt template with exact Russian output headings.
- `.cursor/brain/` — project memory for Cursor (`PROJECT_CONTEXT`, `MAP`, `SKELETONS`, `DECISIONS`, `DICTIONARY`).
- `.cursor/rules/` — local agent rules that enforce the transcript-first workflow.

### Model output language

The summary output defaults to **Russian**.

To switch the whole workflow to another language, edit only:

```text
src/summary/outputLanguage.ts
```

That single config controls:

- the reply language code in `manifest.json`
- the summary artifact filename (`summary.<code>.md`)
- the exact required headings and subheadings
- the validator rules
- the prompt language placeholders
- the ambiguity fallback string and speculative markers

Typical fields you will change:

- `code` — e.g. `ru` -> `es`
- `englishName` — e.g. `Russian` -> `Spanish`
- `requiredHeadings`
- `requiredHandoffSubheadings`
- `ambiguityFallback`
- `speculativeMarkers`
- `contentScriptRegex` / `contentScriptLabel`

After changing the config, rerun:

```bash
npm run ci
npm run agent:prepare -- "<youtube-url>"
```

The new artifact will be written as `summary.<your-code>.md`.

## Development

```bash
npm run test        # unit tests (Vitest)
npm run test:watch
npm run agent:check-summary -- "<summary-file>"
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

**Git hooks (Husky):**

- **pre-commit** — `lint-staged`: ESLint `--fix` + `--max-warnings 0` and Prettier on staged `src/**/*.ts` and selected config/docs.
- **pre-push** — full `npm run ci` with `CI=true` (entire tree: format, lint, types, tests, build).

Unit tests cover **WebVTT parsing**, **Markdown/plain output**, and **subtitle file scoring** (no `yt-dlp` / Whisper required). End-to-end runs still need those tools on your machine; smoke-test locally with a short video URL after `npm run build`.
