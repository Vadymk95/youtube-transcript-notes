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

## Summary contract

Headings, validator rules, and `prompts/video-notes-prompt.md` must stay aligned with `src/summary/outputLanguage.ts`. After changing any of these, run `npm run ci`.

## Where to get help

- [Troubleshooting](docs/troubleshooting.md) — yt-dlp, ffmpeg, Whisper, HTTP 429
- [Reliability handoff (for agents)](docs/reliability-handoff-prompt.md) — incident context and roadmap alignment
- [Technical debt / roadmap](docs/technical-debt-roadmap.md)

## License

By contributing, you agree that your contributions are licensed under the same terms as the project (see [LICENSE](LICENSE)).
