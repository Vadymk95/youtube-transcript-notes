import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { toMarkdown, toPlainText } from './formatTranscript.js';
import { languageFromVttPath, pickBestVtt } from './pickBestVtt.js';
import type { TranscriptMeta, TranscriptSegment } from './types.js';
import { loadSegmentsFromVttFile, runWhisperToVtt } from './whisperFallback.js';
import {
    downloadAudio,
    downloadAutoSubs,
    downloadManualSubs,
    fetchVideoInfo,
    type VideoInfo
} from './ytDlp.js';

export type OutputFormat = 'md' | 'txt';

export type PipelineOptions = {
    url: string;
    /** When set, skips a second yt-dlp metadata fetch (e.g. CLI already resolved the default path). */
    videoInfo?: VideoInfo;
    outputPath: string;
    format: OutputFormat;
    forceWhisper: boolean;
    /** If best subtitle text is shorter than this, try auto then Whisper. */
    minSubtitleChars: number;
    audioFormat: string;
    whisperCommand: string;
    keepWorkDir: boolean;
};

export type PipelineResult = {
    writtenPath: string;
    meta: TranscriptMeta;
    segmentCount: number;
    workDir?: string;
};

function subMeta(
    source: 'subtitle-manual' | 'subtitle-auto',
    pathOrUndefined: string
): TranscriptMeta {
    const language = languageFromVttPath(pathOrUndefined);
    return language === undefined ? { source } : { source, language };
}

async function bestSubtitleSegments(
    url: string,
    workDir: string,
    minChars: number,
    forceWhisper: boolean
): Promise<{
    segments: TranscriptSegment[];
    meta: TranscriptMeta;
} | null> {
    if (forceWhisper) {
        return null;
    }

    const manual = await downloadManualSubs(url, workDir);
    const manualBest = manual.files.length > 0 ? await pickBestVtt(manual.files) : null;
    if (manualBest && manualBest.score >= minChars) {
        return {
            segments: manualBest.segments,
            meta: subMeta('subtitle-manual', manualBest.path)
        };
    }

    const auto = await downloadAutoSubs(url, workDir);
    const autoBest = auto.files.length > 0 ? await pickBestVtt(auto.files) : null;
    if (autoBest && autoBest.score >= minChars) {
        return {
            segments: autoBest.segments,
            meta: subMeta('subtitle-auto', autoBest.path)
        };
    }

    if (manualBest && manualBest.score > 0) {
        return {
            segments: manualBest.segments,
            meta: subMeta('subtitle-manual', manualBest.path)
        };
    }
    if (autoBest && autoBest.score > 0) {
        return {
            segments: autoBest.segments,
            meta: subMeta('subtitle-auto', autoBest.path)
        };
    }

    return null;
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
    const { url, outputPath, format, whisperCommand } = options;
    const info = options.videoInfo ?? (await fetchVideoInfo(url));
    const workDir = await mkdtemp(path.join(os.tmpdir(), 'yt-transcript-'));

    try {
        let segments: TranscriptSegment[];
        let meta: TranscriptMeta;

        const fromSubs = await bestSubtitleSegments(
            url,
            workDir,
            options.minSubtitleChars,
            options.forceWhisper
        );

        if (fromSubs) {
            segments = fromSubs.segments;
            meta = { ...fromSubs.meta, videoId: info.id, title: info.title };
        } else {
            const whisperDir = path.join(workDir, 'whisper-out');
            await mkdir(whisperDir, { recursive: true });
            const audioPath = await downloadAudio(url, workDir, info.id, options.audioFormat);
            const vttPath = await runWhisperToVtt(audioPath, whisperDir, whisperCommand);
            segments = await loadSegmentsFromVttFile(vttPath);
            meta = {
                source: 'whisper',
                videoId: info.id,
                title: info.title
            };
        }

        const body = format === 'md' ? toMarkdown(meta, segments) : toPlainText(segments) + '\n';

        await writeFile(outputPath, body, 'utf8');

        const result: PipelineResult = {
            writtenPath: outputPath,
            meta,
            segmentCount: segments.length
        };
        if (options.keepWorkDir) {
            result.workDir = workDir;
        }
        return result;
    } finally {
        if (!options.keepWorkDir) {
            try {
                await rm(workDir, { recursive: true, force: true });
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(`Warning: failed to remove temp dir ${workDir}: ${msg}`);
            }
        }
    }
}
