# youtube-transcript-notes — Project Context

## Purpose

Local-first YouTube transcript pipeline for Cursor and CLI workflows.

Primary user experience:

1. Open this repo in Cursor.
2. Send a YouTube URL in chat.
3. Agent runs the local workflow.
4. Agent writes `summary.<replyLanguage>.md` (default: `summary.ru.md`).
5. Agent validates it and returns the same summary/plan in the configured reply language.

## Stack

- Node.js 20 (`.nvmrc`)
- TypeScript 5.9 strict
- Native ESM (`"type": "module"`, `NodeNext`)
- Vitest 4
- ESLint 9 flat config
- Prettier 3
- External runtime tools: `yt-dlp`, `ffmpeg`, optional local Whisper CLI

## Canonical Workflow

The repo has one canonical agent flow: `agent:prepare` writes `transcript.md`, `summary-prompt.md`, and `manifest.json` under `artifacts/videos/<videoId>/`. The agent (chat step) writes `summary.<replyLanguage>.md`, then runs `agent:check-summary` until it passes, and replies using that summary in the configured output language.

Do not introduce an alternative default path through an external MCP, remote API, or direct prompt-only summarization unless the user explicitly asks for that architecture.

## Canonical Artifacts

Per video, the workflow writes:

- `transcript.md` — timestamped transcript, source of truth for raw content
- `summary-prompt.md` — model-ready prompt assembled from the transcript
- `summary.<replyLanguage>.md` — final structured handoff summary (default: `summary.ru.md`)
- `manifest.json` — machine-friendly pointers and metadata for the agent (includes `videoDescription` when fetched from YouTube)

The final summary must be validated before the workflow is considered complete.

## Important Commands

Use the Node version from `.nvmrc` (load `nvm` in non-interactive shells if needed). Primary scripts: `agent:prepare`, `agent:complete` (optional prepare + `YT_SUMMARY_CMD` + validate), `agent:check-summary`, and `ci` (see `package.json`).

## Constraints

- Input scope for v1: YouTube URLs only
- Final summary language: presets in `src/summary/outputLanguage.ts`, selected with **`YT_SUMMARY_LANG`** or **`--reply-lang`** (default `ru`; built-in `en`)
- Transcript must come from the local pipeline, not from the title or guessed content
- `prompts/video-notes-prompt.md` is the template authority for the summary structure
