#!/usr/bin/env node
import { parseArgs } from 'node:util';

import {
    runTranscriptQualityHarness,
    type TranscriptQualityFixtureResult
} from '@/transcript/qualityHarness';

function stripCleanedSegments(
    results: readonly TranscriptQualityFixtureResult[]
): Omit<TranscriptQualityFixtureResult, 'cleanedSegments'>[] {
    return results.map(({ cleanedSegments, ...rest }) => {
        void cleanedSegments;
        return rest;
    });
}

function printHelp(): void {
    console.log(`youtube-transcript-notes — transcript quality harness

Usage:
  npm run eval:transcript-quality
  npm run eval:transcript-quality -- --fixture youtube-qku-opening
  npm run eval:transcript-quality -- --language en
  npm run eval:transcript-quality -- --tag real-world
  npm run eval:transcript-quality -- --json
  npm run eval:transcript-quality -- --json --compact

Options:
  --fixture <id>   Run a single built-in fixture
  --language <id>  Filter fixture corpus by fixture language
  --tag <name>     Filter fixture corpus by tag
  --json           Print JSON results
  --compact        With --json: omit per-segment cleaned output (smaller payload)
  -h, --help       Show help
`);
}

async function main(): Promise<void> {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            fixture: { type: 'string' },
            language: { type: 'string' },
            tag: { type: 'string' },
            json: { type: 'boolean', default: false },
            compact: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false }
        },
        allowPositionals: false
    });

    if (values.help) {
        printHelp();
        return;
    }

    const results = await runTranscriptQualityHarness({
        fixtureId: values.fixture,
        language: values.language,
        tag: values.tag
    });

    if (values.compact && !values.json) {
        console.error('Error: --compact is only valid with --json\n');
        process.exitCode = 1;
        return;
    }

    if (values.json) {
        const payload = values.compact ? stripCleanedSegments(results) : results;
        console.log(JSON.stringify(payload, null, 2));
    } else {
        for (const result of results) {
            const status = result.passed ? 'PASS' : 'FAIL';
            console.log(`${status} ${result.fixture.id}: ${result.fixture.description}`);
            console.log(
                `  segments ${result.baseline.segmentCount} -> ${result.cleaned.segmentCount}, ` +
                    `overlap ${result.baseline.adjacentOverlapPairs} -> ${result.cleaned.adjacentOverlapPairs}, ` +
                    `prefix ${result.baseline.adjacentPrefixPairs} -> ${result.cleaned.adjacentPrefixPairs}, ` +
                    `maxWords ${result.baseline.maxSegmentWords} -> ${result.cleaned.maxSegmentWords}`
            );
            for (const item of result.checks) {
                console.log(`  ${item.ok ? 'ok' : '!!'} ${item.name}: ${item.details}`);
            }
        }
    }

    if (!results.every((result) => result.passed)) {
        process.exitCode = 1;
    }
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
