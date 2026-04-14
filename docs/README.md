# Documentation index

All files here are **English** (project convention). Start from **role**, not filename order.

## Everyone (users + contributors)

| Document                                                                                 | Purpose                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [troubleshooting.md](./troubleshooting.md)                                               | yt-dlp, ffmpeg, Whisper, HTTP 429, summary validator failures                                                                                            |
| [grounding-limits-and-future-modalities.md](./grounding-limits-and-future-modalities.md) | Why summaries must stay **transcript-grounded**, how **structure** is enforced, what breaks without **on-screen** context, future work (multimodal / UI) |

**Optional `agent:prepare` artifacts (when enabled):** `verification-hints.md` (URLs + time anchors; no network I/O) and `keyframes/*.jpg` (ffmpeg stills; requires `--key-frames` or `YT_TRANSCRIPT_KEY_FRAMES=1`; heavy download). See README env table.

## Maintainers and roadmap

| Document                                                               | Purpose                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [technical-debt-roadmap.md](./technical-debt-roadmap.md)               | Open backlog (summary density, exploratory items); **`agent:prepare --batch-file`** shipped — see repo README |
| [transcript-external-benchmark.md](./transcript-external-benchmark.md) | Optional network benchmark vs CI-offline harness; golden IDs                                                  |
| [reliability-handoff-prompt.md](./reliability-handoff-prompt.md)       | Copy-paste prompt for incident-style reliability work + pointers to DECISIONS                                 |

## Process and cross-repo

| Document                                                                     | Purpose                                                                            |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [bounded-improvement.md](./bounded-improvement.md)                           | Small verify/keep loops (PDCA-style); maps to this repo’s commands                 |
| [autoresearch-cross-repo-workflow.md](./autoresearch-cross-repo-workflow.md) | Using sibling **agent-autoresearch** as a task harness while editing **this** repo |

## Suggested reading order

1. New to the pipeline: repo `README.md`, then [troubleshooting.md](./troubleshooting.md).
2. Improving summary quality or worried about “model mistakes”: [grounding-limits-and-future-modalities.md](./grounding-limits-and-future-modalities.md), then `prompts/video-notes-prompt.md` and `src/summary/outputLanguage.ts`.
3. Planning larger work: [technical-debt-roadmap.md](./technical-debt-roadmap.md), `.cursor/brain/MAP.md`.
