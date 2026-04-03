# youtube-transcript-notes

## Navigation

Always read `.cursor/brain/PROJECT_CONTEXT.md` before any non-trivial task.
Architecture map: `.cursor/brain/MAP.md`
Danger zones: `.cursor/brain/SKELETONS.md`
Decisions: `.cursor/brain/DECISIONS.md`

## Purpose

This repository is a local-first YouTube transcript and summary workflow.

Canonical chat UX:

1. User sends a YouTube URL.
2. Agent runs `npm run agent:prepare -- "<url>"`.
3. Agent reads `artifacts/videos/<videoId>/manifest.json`.
4. Agent reads `summary-prompt.md`.
5. Agent writes `summary.<replyLanguage>.md` (default: `summary.ru.md`).
6. Agent runs `npm run agent:check-summary -- "<summary-file>"`.
7. If validation fails, agent rewrites the summary and checks again.
8. Agent returns the final answer in the configured reply language.

Do not summarize from the title, URL, or assumptions when the transcript workflow is available.

## Stack

Node 20 · TypeScript 5.9 strict · ESM (`NodeNext`) · Vitest 4 · ESLint 9 · Prettier 3

Runtime dependencies on the machine:

- `yt-dlp`
- `ffmpeg`
- optional local Whisper CLI

## Canonical Artifact Contract

The only canonical generated bundle is:

```text
artifacts/videos/<videoId>/
  transcript.md
  summary-prompt.md
  summary.<replyLanguage>.md
  manifest.json
```

- `manifest.json` is the machine-friendly entrypoint.
- `summary-prompt.md` is the primary source for the final answer.
- `summary.<replyLanguage>.md` is the required persisted handoff output (default: `summary.ru.md`).
- `transcript.md` is the raw fallback source.

## Commands

Before npm commands in agent shells:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use
```

Main commands:

```bash
npm run agent:prepare -- "<youtube-url>"
npm run ci
```

## Rules

- Russian for chat, English for code and docs.
- Keep one canonical local workflow. Do not introduce an external MCP or remote API as the new default path without explicit approval.
- Remove obsolete docs, rules, and artifact contracts when they are superseded.
- Sync `.cursor/brain/` when workflow contracts or project conventions change.
- Use the Ralph Method for summaries: write `summary.<replyLanguage>.md` -> run the validator -> rewrite until it passes.

## Ignore / Noise Control

Treat these paths as non-source noise unless the user explicitly asks to inspect them:

- `node_modules/`
- `dist/`
- `coverage/`
- `artifacts/`
- `.git/`
- `.playwright-mcp/`

Prefer real source files, tests, prompts, `.cursor/brain/`, and `.cursor/rules/`.
Do not search generated or dependency directories for implementation guidance when the same answer exists in project source.
