#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { parseBatchUrlLines, readBatchFileContent } from '@/cli/batchUrlList';
import { assertYoutubeWatchUrl } from '@/shared/youtubeUrlPolicy';
import { prepareAgentWorkflow, type AgentWorkflowOptions } from '@/summary/agentWorkflow';
import { descriptionAlignmentPatchFromCli } from '@/transcript/descriptionAlignmentConfig';

type PrepareOptionsWithoutUrl = Omit<AgentWorkflowOptions, 'url'>;

function printHelp(): void {
    console.log(`youtube-transcript-notes agent workflow

Usage:
  npm run agent:prepare -- <url> [options]
  npm run agent:prepare -- --batch-file <path> [options]
  node dist/cli/agentWorkflowCli.js <url> [options]

Batch (sequential prepares; avoids parallel hammering against YouTube):
  --batch-file <path>      Read one URL per line (empty lines and # comments ignored). Use "-" for stdin.
  --batch-delay-ms <n>     Wait between URLs (default: 0; env YT_TRANSCRIPT_BATCH_DELAY_MS)
  --batch-max <n>          Process at most this many URLs from the file (after parsing)
  --batch-continue-on-error  On failure, record error and continue (stdout JSON includes failures[])

Single-URL options:
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
  prints manifest JSON to stdout (single URL). Batch mode prints one JSON object with results[] (and optional failures[]).
`);
}

function resolveBatchDelayMs(batchDelayMsOpt: string | undefined): number {
    if (batchDelayMsOpt !== undefined && batchDelayMsOpt.trim() !== '') {
        const n = Number.parseInt(batchDelayMsOpt, 10);
        if (!Number.isFinite(n) || n < 0) {
            throw new Error('Error: --batch-delay-ms must be a non-negative integer');
        }
        return n;
    }
    const env = process.env.YT_TRANSCRIPT_BATCH_DELAY_MS?.trim();
    if (env) {
        const n = Number.parseInt(env, 10);
        if (Number.isFinite(n) && n >= 0) {
            return n;
        }
    }
    return 0;
}

function buildPrepareOptions(values: {
    'artifacts-dir'?: string;
    'force-whisper': boolean;
    'min-chars': string;
    'audio-format': string;
    'whisper-cmd'?: string;
    'keep-tmp': boolean;
    'reply-lang'?: string;
    'allow-any-url': boolean;
    'desc-align-policy'?: string;
    'desc-align-min-overlap'?: string;
    'desc-align-min-tokens'?: string;
    'desc-align-min-chars'?: string;
    'no-verification-hints': boolean;
    'key-frames': boolean;
    'key-frame-max'?: string;
    'key-frame-min-interval-sec'?: string;
}): PrepareOptionsWithoutUrl {
    const minChars = Number.parseInt(values['min-chars'], 10);
    if (!Number.isFinite(minChars) || minChars < 0) {
        throw new Error('Error: --min-chars must be a non-negative number');
    }

    const descAlignPatch = descriptionAlignmentPatchFromCli({
        'desc-align-policy': values['desc-align-policy'],
        'desc-align-min-overlap': values['desc-align-min-overlap'],
        'desc-align-min-tokens': values['desc-align-min-tokens'],
        'desc-align-min-chars': values['desc-align-min-chars']
    });

    const keyFrameMaxRaw = values['key-frame-max']
        ? Number.parseInt(values['key-frame-max'], 10)
        : NaN;
    const keyFrameMinRaw = values['key-frame-min-interval-sec']
        ? Number.parseInt(values['key-frame-min-interval-sec'], 10)
        : NaN;

    return {
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
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
            'batch-file': { type: 'string' },
            'batch-delay-ms': { type: 'string' },
            'batch-max': { type: 'string' },
            'batch-continue-on-error': { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false }
        },
        allowPositionals: true
    });

    if (values.help) {
        printHelp();
        process.exit(0);
    }

    const batchFile = values['batch-file'];

    if (batchFile && positionals.length > 0) {
        console.error('Error: do not pass a URL on the command line when using --batch-file\n');
        printHelp();
        process.exit(1);
    }

    if (!batchFile && !positionals[0]) {
        console.error('Error: missing YouTube URL or --batch-file\n');
        printHelp();
        process.exit(1);
    }

    let baseOpts: PrepareOptionsWithoutUrl;
    try {
        baseOpts = buildPrepareOptions(values);
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }

    if (batchFile) {
        let raw: string;
        try {
            raw = await readBatchFileContent(batchFile);
        } catch (e: unknown) {
            console.error(e instanceof Error ? e.message : e);
            process.exit(1);
        }

        let urls = parseBatchUrlLines(raw);
        if (urls.length === 0) {
            console.error('Error: --batch-file contains no URLs\n');
            process.exit(1);
        }

        const batchMaxRaw = values['batch-max']?.trim();
        if (batchMaxRaw) {
            const cap = Number.parseInt(batchMaxRaw, 10);
            if (!Number.isFinite(cap) || cap < 1) {
                console.error('Error: --batch-max must be a positive integer');
                process.exit(1);
            }
            urls = urls.slice(0, cap);
        }

        let delayMs: number;
        try {
            delayMs = resolveBatchDelayMs(values['batch-delay-ms']);
        } catch (e: unknown) {
            console.error(e instanceof Error ? e.message : e);
            process.exit(1);
        }

        const continueOnError = values['batch-continue-on-error'];
        const results: unknown[] = [];
        const failures: { url: string; error: string }[] = [];

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            if (i > 0 && delayMs > 0) {
                await sleep(delayMs);
            }
            try {
                assertYoutubeWatchUrl(url, { allowAnyUrl: values['allow-any-url'] });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (!continueOnError) {
                    console.error(msg);
                    process.exit(1);
                }
                failures.push({ url, error: msg });
                continue;
            }

            try {
                const result = await prepareAgentWorkflow({ ...baseOpts, url });
                results.push(result);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                if (!continueOnError) {
                    console.error(msg);
                    process.exit(1);
                }
                failures.push({ url, error: msg });
            }
        }

        const payload: Record<string, unknown> = {
            batch: true,
            count: results.length,
            results
        };
        if (failures.length > 0) {
            payload.failures = failures;
        }
        console.log(JSON.stringify(payload, null, 2));

        if (failures.length > 0) {
            process.exit(1);
        }
        return;
    }

    const url = positionals[0];
    try {
        assertYoutubeWatchUrl(url, { allowAnyUrl: values['allow-any-url'] });
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }

    try {
        const result = await prepareAgentWorkflow({ ...baseOpts, url });
        console.log(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
