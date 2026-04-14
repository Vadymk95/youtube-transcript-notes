#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { assertYoutubeWatchUrl } from '@/shared/youtubeUrlPolicy';
import { prepareAgentWorkflow } from '@/summary/agentWorkflow';
import { descriptionAlignmentPatchFromCli } from '@/transcript/descriptionAlignmentConfig';

function printHelp(): void {
    console.log(`youtube-transcript-notes agent workflow

Usage:
  npm run agent:prepare -- <url> [options]
  node dist/cli/agentWorkflowCli.js <url> [options]

Options:
  --artifacts-dir <dir>    Artifact root (default: ./artifacts/videos)
  --force-whisper          Skip yt-dlp subtitles and run Whisper
  --min-chars <n>          Minimum subtitle characters before Whisper fallback
  --audio-format <ext>     Audio format passed to yt-dlp -x (default: m4a)
  --whisper-cmd <shell>    Override whisper command; use {{audio}} and {{outdir}}
  --keep-tmp               Keep temp work directory from runPipeline
  --reply-lang <code>      Summary preset: ru | en (overrides YT_SUMMARY_LANG)
  --allow-any-url          Skip YouTube-only URL allowlist (see YT_TRANSCRIPT_ALLOW_ANY_URL)
  --desc-align-policy <h>  heuristic | always_include (overrides YT_TRANSCRIPT_DESC_ALIGN_POLICY)
  --desc-align-min-overlap <n>  (0,1] — min token overlap to keep YAML description
  --desc-align-min-tokens <n>    min contentful description tokens before judging misalignment
  --desc-align-min-chars <n>     min description length before judging misalignment
  --no-verification-hints   Skip verification-hints.md (URLs + time anchors; default: write)
  --key-frames             Download merged video and extract JPEG stills under keyframes/ (heavy)
  --key-frame-max <n>      Max stills with --key-frames (default: 24; env YT_TRANSCRIPT_KEY_FRAME_MAX)
  --key-frame-min-interval-sec <n>  Min seconds between stills (default: 45)
  -h, --help               Show help

Output:
  Writes transcript, summary-prompt, manifest, cursor-handoff, optional verification-hints.md and keyframes/;
  prints manifest JSON to stdout.
`);
}

async function main(): Promise<void> {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            'artifacts-dir': { type: 'string' },
            'force-whisper': { type: 'boolean', default: false },
            'min-chars': { type: 'string', default: '80' },
            'audio-format': { type: 'string', default: 'm4a' },
            'whisper-cmd': { type: 'string' },
            'keep-tmp': { type: 'boolean', default: false },
            'reply-lang': { type: 'string' },
            'allow-any-url': { type: 'boolean', default: false },
            'desc-align-policy': { type: 'string' },
            'desc-align-min-overlap': { type: 'string' },
            'desc-align-min-tokens': { type: 'string' },
            'desc-align-min-chars': { type: 'string' },
            'no-verification-hints': { type: 'boolean', default: false },
            'key-frames': { type: 'boolean', default: false },
            'key-frame-max': { type: 'string' },
            'key-frame-min-interval-sec': { type: 'string' },
            help: { type: 'boolean', short: 'h', default: false }
        },
        allowPositionals: true
    });

    if (values.help) {
        printHelp();
        process.exit(0);
    }

    const url = positionals[0];
    if (!url) {
        console.error('Error: missing YouTube URL\n');
        printHelp();
        process.exit(1);
    }

    try {
        assertYoutubeWatchUrl(url, { allowAnyUrl: values['allow-any-url'] });
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }

    const minChars = Number.parseInt(values['min-chars'], 10);
    if (!Number.isFinite(minChars) || minChars < 0) {
        console.error('Error: --min-chars must be a non-negative number');
        process.exit(1);
    }

    let descAlignPatch;
    try {
        descAlignPatch = descriptionAlignmentPatchFromCli({
            'desc-align-policy': values['desc-align-policy'],
            'desc-align-min-overlap': values['desc-align-min-overlap'],
            'desc-align-min-tokens': values['desc-align-min-tokens'],
            'desc-align-min-chars': values['desc-align-min-chars']
        });
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }

    const keyFrameMaxRaw = values['key-frame-max']
        ? Number.parseInt(values['key-frame-max'], 10)
        : NaN;
    const keyFrameMinRaw = values['key-frame-min-interval-sec']
        ? Number.parseInt(values['key-frame-min-interval-sec'], 10)
        : NaN;

    const result = await prepareAgentWorkflow({
        url,
        artifactsDir: values['artifacts-dir'],
        replyLanguage: values['reply-lang'],
        forceWhisper: values['force-whisper'],
        minSubtitleChars: minChars,
        audioFormat: values['audio-format'],
        whisperCommand: values['whisper-cmd'],
        keepWorkDir: values['keep-tmp'],
        descriptionAlignment: descAlignPatch,
        verificationHints: values['no-verification-hints'] ? false : undefined,
        keyFrames: values['key-frames'] ? true : undefined,
        keyFrameMax:
            Number.isFinite(keyFrameMaxRaw) && keyFrameMaxRaw > 0 ? keyFrameMaxRaw : undefined,
        keyFrameMinIntervalSec:
            Number.isFinite(keyFrameMinRaw) && keyFrameMinRaw > 0 ? keyFrameMinRaw : undefined
    });

    console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
