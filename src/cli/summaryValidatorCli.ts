#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { validateSummary } from '@/summary/summaryContract';

function printHelp(): void {
    console.log(`youtube-transcript-notes summary validator

Usage:
  npm run agent:check-summary -- <summary-file>
  node dist/summaryValidatorCli.js <summary-file>

Output:
  Prints JSON validation result to stdout and exits with code 0 on success, 1 on failure.
`);
}

async function main(): Promise<void> {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
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
    const result = validateSummary(content);

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

    process.exit(result.valid ? 0 : 1);
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
