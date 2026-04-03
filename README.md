# youtube-transcript-notes

Small **Node.js + TypeScript CLI** that turns a **YouTube URL** into a single **transcript file** for note-taking or LLM workflows (no video playback).

## What it does

1. Fetches **manual subtitles** with [yt-dlp](https://github.com/yt-dlp/yt-dlp) (WebVTT).
2. If they are missing or too short, tries **auto-generated** captions.
3. If that still fails (or you pass `--force-whisper`), downloads **audio** and runs a **local Whisper** command you configure (default expects the `whisper` CLI).

Output:

- **`md`** — YAML front matter plus segments like `**[MM:SS]** text` (default).
- **`txt`** — plain text, no timestamps.

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
node dist/cli.js "<url>" -o ./notes.md
```

Useful flags: `--format txt`, `--force-whisper`, `--min-chars <n>`, `--audio-format m4a`, `--whisper-cmd "<shell with {{audio}} and {{outdir}}>"`, `--keep-tmp`. See `npm run dev -- --help`.

Environment:

- `YT_TRANSCRIPT_WHISPER_CMD` — default Whisper shell template
- `YT_TRANSCRIPT_DEBUG` — log yt-dlp failures to stderr

## Repo layout

- `prompts/video-notes-prompt.md` — LLM prompt (English instructions; default **model reply in Russian**).
- `docs/mcp-setup.md` — using a **community MCP** for transcripts in Cursor vs this CLI (yt-dlp + Whisper).

### Model output language

The prompt defaults to **Russian** for the assistant’s answer. To use another language, edit `prompts/video-notes-prompt.md` and replace **Russian** / **russian** everywhere it sets the reply language—mainly:

1. The **Model output language** line under the title (human note).
2. The **Language requirement** sentence in the block you send to the model (e.g. change “Russian” to “Ukrainian”, “Spanish”, etc.).
3. The phrase **Russian section titles** in that same sentence (e.g. “Spanish section titles”) so headings match the target language.

Keep the rest of the instructions in English unless you also want to localize them.

## Development

```bash
npm run test        # unit tests (Vitest)
npm run test:watch
npm run ci          # format:check, lint (0 warnings), typecheck, test, build
npm run verify      # same as ci
```

**Git hooks (Husky):**

- **pre-commit** — `lint-staged`: ESLint `--fix` + `--max-warnings 0` and Prettier on staged `src/**/*.ts` and selected config/docs.
- **pre-push** — full `npm run ci` with `CI=true` (entire tree: format, lint, types, tests, build).

Unit tests cover **WebVTT parsing**, **Markdown/plain output**, and **subtitle file scoring** (no `yt-dlp` / Whisper required). End-to-end runs still need those tools on your machine; smoke-test locally with a short video URL after `npm run build`.
