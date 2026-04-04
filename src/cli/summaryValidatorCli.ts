#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { resolveSummaryOutputLanguage } from '@/summary/outputLanguage';
import { validateSummary, type SummaryValidationResult } from '@/summary/summaryContract';
import { formatSummaryValidationHints } from '@/summary/summaryValidationHints';

function printHelp(): void {
    console.log(`youtube-transcript-notes summary validator

Usage:
  npm run agent:check-summary -- <summary-file> [--reply-lang <code>]
  node dist/summaryValidatorCli.js <summary-file>

Options:
  --reply-lang <code>   Preset: ru | en (overrides YT_SUMMARY_LANG; must match how the summary was written)

Output:
  Always prints one JSON object to stdout (including invalid --reply-lang / YT_SUMMARY_LANG), then exits 0 on success and 1 on failure.
  On failure, also prints a short hint block to stderr (next-step commands; stdout stays JSON-only for scripts).
`);
}

async function main(): Promise<void> {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            'reply-lang': { type: 'string' },
            help: { type: 'boolean', short: 'h', default: false }
        },
        allowPositionals: true
    });

    if (values.help) {
        printHelp();
        process.exit(0);
    }

    const summaryFile = positionals[0];
    if (!summaryFile) {
        console.error('Error: missing summary file path\n');
        printHelp();
        process.exit(1);
    }

    const absolutePath = path.resolve(process.cwd(), summaryFile);
    const content = await readFile(absolutePath, 'utf8');

    let result: SummaryValidationResult;
    try {
        result = validateSummary(content, values['reply-lang']);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        result = { valid: false, errors: [message] };
    }

    console.log(
        JSON.stringify(
            {
                file: absolutePath,
                ...result
            },
            null,
            2
        )
    );

    if (!result.valid) {
        try {
            const lang = resolveSummaryOutputLanguage(values['reply-lang']).code;
            console.error(
                formatSummaryValidationHints({
                    errors: result.errors,
                    replyLanguage: lang,
                    summaryPath: absolutePath
                })
            );
        } catch {
            console.error(
                formatSummaryValidationHints({
                    errors: result.errors,
                    summaryPath: absolutePath
                })
            );
        }
    }

    process.exit(result.valid ? 0 : 1);
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
