#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { assertYoutubeWatchUrl } from '@/shared/youtubeUrlPolicy';
import { runAgentComplete, SummaryValidationFailedError } from '@/summary/agentCompleteFlow';
import { formatSummaryValidationHints } from '@/summary/summaryValidationHints';

function printHelp(): void {
    console.log(`youtube-transcript-notes — prepare + optional local summary + validate

Usage:
  npm run agent:complete -- <url> [options]

Options:
  (same as agent:prepare)
  --prepare-only           Only run prepare; print JSON (no YT_SUMMARY_CMD needed)
  --summary-cmd <shell>    Overrides YT_SUMMARY_CMD for this run (sh -c template)
  --attempts <n>           Max summary+validate tries (1–10, default 1)
  --allow-any-url          Skip YouTube-only URL allowlist (see YT_TRANSCRIPT_ALLOW_ANY_URL)
  -h, --help               Show help

Summary command placeholders (use absolute paths; all are substituted for you):
  {{SUMMARY_PROMPT_PATH}}, {{SUMMARY_OUT_PATH}}, {{TRANSCRIPT_PATH}},
  {{VIDEO_ID}}, {{MANIFEST_PATH}}, {{ARTIFACT_DIR}}

Each run must overwrite {{SUMMARY_OUT_PATH}} (do not append); retries read that file for validation.

Environment:
  YT_SUMMARY_CMD           Default shell template when not using --summary-cmd
  YT_SUMMARY_LANG          Same as agent:prepare (--reply-lang overrides)

Without --prepare-only, YT_SUMMARY_CMD or --summary-cmd is required.
Local-first: this repo does not call a cloud API; you wire ollama, claude CLI, etc.

Output:
  JSON to stdout. Exit 0 on success; 1 on error; validation failures print errors in JSON and a hint block on stderr.
`);
}

function parseAttempts(raw: string | undefined): number {
    if (raw === undefined) {
        return 1;
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
        throw new Error('Error: --attempts must be between 1 and 10');
    }
    return n;
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
            'prepare-only': { type: 'boolean', default: false },
            'summary-cmd': { type: 'string' },
            attempts: { type: 'string', default: '1' },
            'allow-any-url': { type: 'boolean', default: false },
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

    let attempts: number;
    try {
        attempts = parseAttempts(values.attempts);
    } catch (e: unknown) {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    }

    try {
        const result = await runAgentComplete({
            workflow: {
                url,
                artifactsDir: values['artifacts-dir'],
                replyLanguage: values['reply-lang'],
                forceWhisper: values['force-whisper'],
                minSubtitleChars: minChars,
                audioFormat: values['audio-format'],
                whisperCommand: values['whisper-cmd'],
                keepWorkDir: values['keep-tmp']
            },
            prepareOnly: values['prepare-only'],
            summaryCommandTemplate: values['summary-cmd'],
            maxAttempts: attempts
        });

        console.log(JSON.stringify(result, null, 2));
    } catch (e: unknown) {
        if (e instanceof SummaryValidationFailedError) {
            console.error(e.message);
            console.error(
                JSON.stringify(
                    {
                        validation: e.validation,
                        summaryPath: e.summaryPath,
                        replyLanguage: e.replyLanguage,
                        attempts: e.attempts
                    },
                    null,
                    2
                )
            );
            console.error(
                formatSummaryValidationHints({
                    errors: e.validation.errors,
                    replyLanguage: e.replyLanguage,
                    summaryPath: e.summaryPath
                })
            );
            process.exit(1);
        }
        throw e;
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
