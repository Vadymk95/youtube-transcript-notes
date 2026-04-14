import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    assertWhisperCommandResolvable,
    loadSegmentsFromVttFile,
    runWhisperToVtt
} from '@/pipeline/whisperFallback';
import {
    downloadAudio,
    downloadAutoSubs,
    downloadManualSubs,
    fetchVideoInfo,
    type VideoInfo
} from '@/pipeline/ytDlp';
import { collapseRollingAutoCaptions } from '@/transcript/collapseRollingCaptions';
import {
    mergeDescriptionAlignment,
    resolveDescriptionAlignmentFromEnv,
    type DescriptionAlignmentPatch,
    type DescriptionAlignmentPolicy
} from '@/transcript/descriptionAlignmentConfig';
import {
    assessVideoDescriptionAlignment,
    type VideoDescriptionAlignment
} from '@/transcript/descriptionTranscriptAlignment';
import { toMarkdown, toPlainText } from '@/transcript/formatTranscript';
import { languageFromVttPath, pickBestVtt } from '@/transcript/pickBestVtt';
import type { TranscriptMeta, TranscriptSegment } from '@/transcript/types';

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
    /** Overrides env (`YT_TRANSCRIPT_DESC_ALIGN_*`); CLI passes partial policy/thresholds. */
    descriptionAlignment?: DescriptionAlignmentPatch;
};

export type PipelineResult = {
    writtenPath: string;
    meta: TranscriptMeta;
    /** Final transcript segments (post-collapse when auto captions). Used for optional key-frame timing. */
    segments: TranscriptSegment[];
    segmentCount: number;
    workDir?: string;
    videoDescriptionAlignment: VideoDescriptionAlignment;
    /** Fraction of counted description tokens found in transcript (0–1). */
    videoDescriptionLexicalOverlap: number;
    videoDescriptionTokenCount: number;
    /** Page description omitted from `transcript.md` YAML when overlap vs spoken text is very low. */
    videoDescriptionOmittedFromTranscriptYaml: boolean;
    /** Effective policy after env + option merge (`always_include` never omits YAML). */
    videoDescriptionAlignmentPolicy: DescriptionAlignmentPolicy;
};

function subMeta(
    source: 'subtitle-manual' | 'subtitle-auto',
    pathOrUndefined: string
): TranscriptMeta {
    const language = languageFromVttPath(pathOrUndefined);
    return language === undefined ? { source } : { source, language };
}

function metaFromVideoInfo(
    info: VideoInfo
): Pick<TranscriptMeta, 'videoId' | 'title' | 'description'> {
    return {
        videoId: info.id,
        title: info.title,
        ...(info.description !== '' ? { description: info.description } : {})
    };
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
            segments =
                fromSubs.meta.source === 'subtitle-auto'
                    ? collapseRollingAutoCaptions(fromSubs.segments)
                    : fromSubs.segments;
            meta = { ...fromSubs.meta, ...metaFromVideoInfo(info) };
        } else {
            await assertWhisperCommandResolvable(whisperCommand);
            const whisperDir = path.join(workDir, 'whisper-out');
            await mkdir(whisperDir, { recursive: true });
            const audioPath = await downloadAudio(url, workDir, info.id, options.audioFormat);
            const vttPath = await runWhisperToVtt(audioPath, whisperDir, whisperCommand);
            segments = await loadSegmentsFromVttFile(vttPath);
            meta = {
                source: 'whisper',
                ...metaFromVideoInfo(info)
            };
        }

        const pageDescription = info.description ?? '';
        const plainTranscript = toPlainText(segments);
        const descAlign = mergeDescriptionAlignment(
            resolveDescriptionAlignmentFromEnv(process.env),
            options.descriptionAlignment
        );
        const descAssessment = assessVideoDescriptionAlignment(
            pageDescription,
            plainTranscript,
            descAlign.thresholds
        );
        const shouldOmitDescriptionFromYaml =
            descAlign.policy === 'heuristic' &&
            descAssessment.alignment === 'low' &&
            meta.description !== undefined &&
            meta.description !== '';

        const metaForMarkdown: TranscriptMeta = { ...meta };
        if (shouldOmitDescriptionFromYaml) {
            delete metaForMarkdown.description;
        }

        const body =
            format === 'md' ? toMarkdown(metaForMarkdown, segments) : toPlainText(segments) + '\n';

        await writeFile(outputPath, body, 'utf8');

        const result: PipelineResult = {
            writtenPath: outputPath,
            meta,
            segments,
            segmentCount: segments.length,
            videoDescriptionAlignment: descAssessment.alignment,
            videoDescriptionLexicalOverlap: descAssessment.overlapRatio,
            videoDescriptionTokenCount: descAssessment.descriptionTokenCount,
            videoDescriptionOmittedFromTranscriptYaml: shouldOmitDescriptionFromYaml,
            videoDescriptionAlignmentPolicy: descAlign.policy
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
