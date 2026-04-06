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
  -h, --help               Show help

Output:
  Writes transcript, summary-prompt, manifest, cursor-handoff, and summary path fields; prints manifest JSON to stdout.
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

    const result = await prepareAgentWorkflow({
        url,
        artifactsDir: values['artifacts-dir'],
        replyLanguage: values['reply-lang'],
        forceWhisper: values['force-whisper'],
        minSubtitleChars: minChars,
        audioFormat: values['audio-format'],
        whisperCommand: values['whisper-cmd'],
        keepWorkDir: values['keep-tmp'],
        descriptionAlignment: descAlignPatch
    });

    console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
