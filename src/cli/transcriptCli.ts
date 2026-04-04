#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { runPipeline } from '@/pipeline/pipeline';
import { DEFAULT_WHISPER_CMD } from '@/pipeline/whisperFallback';
import { fetchVideoInfo } from '@/pipeline/ytDlp';
import { assertYoutubeWatchUrl } from '@/shared/youtubeUrlPolicy';

function printHelp(): void {
    console.log(`youtube-transcript-notes — YouTube URL → transcript file

Usage:
  yt-transcript <url> [options]
  npm run dev -- <url>   (from source)

Options:
  -o, --output <file>     Output path (default: ./<videoId>.transcript.md)
  --format md|txt         Output format (default: md)
  --force-whisper         Skip yt-dlp subtitles; download audio and run Whisper
  --min-chars <n>         Minimum subtitle characters before accepting (default: 80)
  --audio-format <ext>    Passed to yt-dlp -x (default: m4a)
  --whisper-cmd <shell>   Override whisper command; use {{audio}} and {{outdir}}
  --keep-tmp              Keep temp work directory (prints path on stderr)
  --allow-any-url         Skip YouTube-only URL allowlist (non-YouTube extractors; still validates video id)
  -h, --help              Show help

Environment:
  YT_DLP_BIN              yt-dlp binary (default: yt-dlp)
  YT_TRANSCRIPT_WHISPER_CMD   Default whisper shell command
  YT_TRANSCRIPT_DEBUG     Print yt-dlp failures to stderr
  YT_TRANSCRIPT_ALLOW_ANY_URL   Set to 1/true to skip YouTube hostname allowlist (same as --allow-any-url)

Whisper must be installed separately (e.g. pip install openai-whisper).
Default command expects the \`whisper\` CLI on PATH.
`);
}

async function main(): Promise<void> {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            output: { type: 'string', short: 'o' },
            format: { type: 'string', default: 'md' },
            'force-whisper': { type: 'boolean', default: false },
            'min-chars': { type: 'string', default: '80' },
            'audio-format': { type: 'string', default: 'm4a' },
            'whisper-cmd': { type: 'string' },
            'keep-tmp': { type: 'boolean', default: false },
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

    const fmt = values.format === 'txt' ? 'txt' : 'md';
    const minChars = Number.parseInt(values['min-chars'], 10);
    if (!Number.isFinite(minChars) || minChars < 0) {
        console.error('Error: --min-chars must be a non-negative number');
        process.exit(1);
    }

    const info = await fetchVideoInfo(url);
    const defaultName = `${info.id}.transcript.${fmt}`;
    const outputPath = path.resolve(process.cwd(), values.output ?? defaultName);
    const outDir = path.dirname(outputPath);
    await mkdir(outDir, { recursive: true });

    const whisperCommand = values['whisper-cmd'] ?? DEFAULT_WHISPER_CMD;

    const result = await runPipeline({
        url,
        videoInfo: info,
        outputPath,
        format: fmt,
        forceWhisper: values['force-whisper'],
        minSubtitleChars: minChars,
        audioFormat: values['audio-format'],
        whisperCommand,
        keepWorkDir: values['keep-tmp']
    });

    if (values['keep-tmp'] && result.workDir) {
        console.error(`Kept temp dir: ${result.workDir}`);
    }

    console.error(
        `Wrote ${String(result.segmentCount)} segments → ${result.writtenPath} (${
            result.meta.source
        })`
    );
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
