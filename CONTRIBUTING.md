# Contributing

## Prerequisites

- **Node.js** 20+ (see `.nvmrc`; use `nvm use` if you use nvm)
- **npm** (comes with Node)
- For end-to-end checks on your machine: **yt-dlp**, **ffmpeg**, and optionally **Whisper** (see README)

## Setup

```bash
npm install
npm run build
```

## Before you open a PR

```bash
npm run ci
```

This runs Prettier check, ESLint (zero warnings), TypeScript, tests, production build, and the transcript quality harness. CI on GitHub runs the same command.

## Hooks

This repo uses **Husky**: pre-commit runs `lint-staged` on staged files; pre-push runs full `npm run ci` when `CI` is not already set (see `.husky/`).

## Caption cleanup changes

If you touch auto-caption collapse or overlap logic under `src/transcript/`, also run:

```bash
npm run eval:transcript-quality
```

Protected fixtures must not regress.

## Agent bundle commands

```bash
npm run agent:prepare -- "<youtube-url>"
npm run agent:check-summary -- "artifacts/videos/<videoId>/summary.<replyLanguage>.md"
npm run agent:complete -- "<youtube-url>" --prepare-only
```

Optional **`agent:prepare`** / **`agent:complete`**: `--no-verification-hints`, `--key-frames`, `--key-frame-max`, `--key-frame-min-interval-sec` (see README env table). Key frames trigger a second yt-dlp download plus ffmpeg — use sparingly.

Run **`agent:check-summary`** after the handoff `summary.<replyLanguage>.md` exists (`manifest.json` shows `replyLanguage`; pass `--reply-lang` when not default `ru`). See **Summary contract** below.

Full loop with a **local** summarizer: configure `YT_SUMMARY_CMD` (see README), then `npm run agent:complete -- "<youtube-url>"`. The repo does not run a remote LLM by default.

## Summary contract

Headings, validator rules, and `prompts/video-notes-prompt.md` must stay aligned with the presets in `src/summary/outputLanguage.ts`. End users pick `ru` or `en` via `YT_SUMMARY_LANG` / `--reply-lang`; new locales require a new preset entry. After changing any of these, run `npm run ci`.

## Where to get help

- [Documentation index](docs/README.md) — all docs by role
- [Troubleshooting](docs/troubleshooting.md) — yt-dlp, ffmpeg, Whisper, HTTP 429
- [Grounding, structure, and UI limits](docs/grounding-limits-and-future-modalities.md) — accurate summaries, contract shape, on-screen gaps
- [Reliability handoff (for agents)](docs/reliability-handoff-prompt.md) — incident context and roadmap alignment
- [Technical debt / roadmap](docs/technical-debt-roadmap.md)

## License

By contributing, you agree that your contributions are licensed under the same terms as the project (see [LICENSE](LICENSE)).
