# Transcript external benchmark (maintainer-only)

This document defines an **optional, network-dependent** check that complements the **offline** caption cleanup harness (`npm run eval:transcript-quality`). CI does **not** call YouTube; golden lists live in-repo for **discipline and repeatability**, not for automated remote pulls.

## What is being compared

| Lane                               | Meaning                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — yt-dlp raw**                 | Fetch WebVTT (or other subtitle format) with yt-dlp **only**, without this repo’s VTT ranking, overlap trimming, or `collapseRollingAutoCaptions()`. Use this as a baseline for “what YouTube gave us” on disk.     |
| **B — this repo**                  | `npm run dev -- "<url>"` (or `node dist/cli/transcriptCli.js`) with default pipeline: manual/auto track selection, parsing, and **auto-caption** collapse when applicable.                                          |
| **C — third-party npm (optional)** | Any published `youtube-transcript` helper you want to track (different API surface, caching, rate limits). **Not** part of this repo’s dependencies; record tool name + version in your run notes when you compare. |

**Regression target:** for the same `videoId`, lane **B** should not grow **plain body character count** or duplicate **rolling auto-caption** noise versus **A** in a way that hurts readability. Exact numbers drift when YouTube edits captions; record **hashes or metrics in a dated note** (see below) instead of freezing byte-identical gold files unless you snapshot VTT yourself.

## In-repo offline gate (must stay green)

Before merging changes that touch `collapseRollingCaptions`, `parseVtt`, or the transcript pipeline:

```bash
npm run ci
```

`eval:transcript-quality` is the **machine-enforced** contract on synthetic + one curated real excerpt (`youtube-qku-opening`). The external benchmark is **Additional** human/maintainer signal when you change heuristics.

## Golden video list

Curated IDs: [`fixtures/benchmark-videos/manifest.json`](../fixtures/benchmark-videos/manifest.json).

- Add videos **sparingly** (short, clear licensing/ToS risk tolerance, likely to stay public).
- If a listed video disappears or is geo-blocked, **remove or replace** the entry and note the date in git history or a short changelog section below.

## Suggested procedure (single video)

Replace `VIDEO_ID` with an id from the manifest.

1. **Lane B (this repo)** — write Markdown transcript:

    ```bash
    npm run dev -- "https://www.youtube.com/watch?v=VIDEO_ID" -o ./bench-repo.md
    ```

    Record: exit code, file size, approximate segment count (e.g. count `**[` lines), and `wc -c` on the body if needed.

2. **Lane A (yt-dlp raw)** — download VTT only into a temp dir (flags may vary by yt-dlp version):

    ```bash
    mkdir -p /tmp/yt-bench-VIDEO_ID
    yt-dlp --skip-download --write-subs --sub-langs en --sub-format vtt \
      -o "/tmp/yt-bench-VIDEO_ID/%(id)s" "https://www.youtube.com/watch?v=VIDEO_ID"
    ```

    Compare the **largest / best** VTT you would pick by eye vs what the repo picks internally. This lane is intentionally “no project logic”.

3. **Optional C** — run your chosen npm tool with the same URL; paste tool + version in commit message or issue.

4. **Pass/fail (manual):** **Fail** the candidate change if lane B regresses readability obvious on that video (exploded duplicate lines, missing sentence boundaries readers care about, or sudden giant segments). **Pass** if B is same or better than prior tagged release on the same video, or if drift is explained by YouTube changing source captions (re-verify lane A).

## When to run

- Before merging non-trivial PRs in `src/transcript/` or `src/pipeline/`.
- Periodically (e.g. quarterly) even without code changes, because **YouTube can change captions** without a repo release.

## Non-goals

- No promises of legal vetting of benchmark videos.
- No automated scraping of playlists or bulk channel downloads.
- No default dependency on a specific third-party transcript npm package.
