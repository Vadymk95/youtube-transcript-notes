# youtube-transcript-notes

Small **Node.js + TypeScript CLI** for turning a **YouTube URL** into a transcript, plus an **agent-friendly workflow** for Cursor chats where you drop a YouTube link and get a ready-to-use Russian summary file for handoff to the next AI agent.

## What it does

1. Fetches **manual subtitles** with [yt-dlp](https://github.com/yt-dlp/yt-dlp) (WebVTT).
2. If they are missing or too short, tries **auto-generated** captions.
3. If that still fails (or you pass `--force-whisper`), downloads **audio** and runs a **local Whisper** command you configure (default expects the `whisper` CLI).

Output:

- **`md`** — YAML front matter plus segments like `**[MM:SS]** text` (default).
- **`txt`** — plain text, no timestamps.
- **Agent workflow artifacts** — transcript, summary prompt, Russian summary file, and manifest JSON under `./artifacts/videos/<videoId>/`.

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
- `artifacts/videos/<videoId>/summary.ru.md`
- `artifacts/videos/<videoId>/manifest.json`

It also prints the same paths and metadata as JSON to stdout. The intended flow is:

1. Generate transcript and prompt with `agent:prepare`.
2. Write the final Russian summary to `summary.ru.md`.
3. Validate it with `npm run agent:check-summary -- "artifacts/videos/<videoId>/summary.ru.md"`.
4. If validation fails, rewrite the summary and validate again.
5. Keep the Russian summary strictly grounded in the transcript. If a detail is missing, state `Не указано в транскрипте` instead of guessing.

### Cursor chat workflow

Once this repo is open in Cursor, you can send the agent a YouTube link and ask for a Russian summary or plan. The local rules in `.cursor/rules/` tell the agent to:

1. Run `npm run agent:prepare -- "<url>"`.
2. Read `manifest.json`, then `summary-prompt.md`.
3. Write the final Russian handoff summary to `summary.ru.md`.
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

The prompt defaults to **Russian** for the assistant’s answer. To use another language, edit `prompts/video-notes-prompt.md` and replace **Russian** / **russian** everywhere it sets the reply language—mainly:

1. The **Model output language** line under the title (human note).
2. The **Language requirement** sentence in the block you send to the model (e.g. change “Russian” to “Ukrainian”, “Spanish”, etc.).
3. The exact Russian headings and subheadings in the required output block so the validator can be updated to match the new target language.

If you change the output language, also update `src/summary/summaryContract.ts` and `src/summary/agentWorkflow.ts` so the validator and manifest stay aligned with the new reply language.

Keep the rest of the instructions in English unless you also want to localize them.

## Development

```bash
npm run test        # unit tests (Vitest)
npm run test:watch
npm run agent:check-summary -- "<summary-file>"
npm run ci          # format:check, lint (0 warnings), typecheck, test, build
npm run verify      # same as ci
```

**Git hooks (Husky):**

- **pre-commit** — `lint-staged`: ESLint `--fix` + `--max-warnings 0` and Prettier on staged `src/**/*.ts` and selected config/docs.
- **pre-push** — full `npm run ci` with `CI=true` (entire tree: format, lint, types, tests, build).

Unit tests cover **WebVTT parsing**, **Markdown/plain output**, and **subtitle file scoring** (no `yt-dlp` / Whisper required). End-to-end runs still need those tools on your machine; smoke-test locally with a short video URL after `npm run build`.
