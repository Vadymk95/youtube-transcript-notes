import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { downloadVideoAndExtractKeyFrames } from '@/pipeline/keyFramePipeline';
import { runPipeline } from '@/pipeline/pipeline';
import { DEFAULT_WHISPER_CMD } from '@/pipeline/whisperFallback';
import { fetchVideoInfo } from '@/pipeline/ytDlp';
import {
    type SummaryOutputLanguageConfig,
    promptTemplateVariables,
    resolveSummaryOutputLanguage,
    summaryFileName
} from '@/summary/outputLanguage';
import { computeTranscriptCharMetrics } from '@/summary/transcriptMetrics';
import { buildVerificationHintsMarkdown } from '@/summary/verificationHints';
import type {
    DescriptionAlignmentPatch,
    DescriptionAlignmentPolicy
} from '@/transcript/descriptionAlignmentConfig';
import type { VideoDescriptionAlignment } from '@/transcript/descriptionTranscriptAlignment';
import type { TranscriptMeta } from '@/transcript/types';

export const DEFAULT_ARTIFACTS_DIR = path.join('artifacts', 'videos');

/** Editor-oriented next steps; written beside the canonical artifact bundle. */
export const CURSOR_HANDOFF_BASENAME = 'cursor-handoff.md';

/** URLs + transcript anchors for manual fact-checking (no network I/O). */
export const VERIFICATION_HINTS_BASENAME = 'verification-hints.md';

const PROMPT_TEMPLATE_PATH = fileURLToPath(
    new URL('../../prompts/video-notes-prompt.md', import.meta.url)
);

export type AgentWorkflowOptions = {
    url: string;
    artifactsDir?: string;
    /** ISO-style preset code, e.g. `ru`, `en`. Overrides `YT_SUMMARY_LANG`. */
    replyLanguage?: string;
    forceWhisper?: boolean;
    minSubtitleChars?: number;
    audioFormat?: string;
    whisperCommand?: string;
    keepWorkDir?: boolean;
    /** Overrides `YT_TRANSCRIPT_DESC_ALIGN_*` for this prepare run. */
    descriptionAlignment?: DescriptionAlignmentPatch;
    /**
     * Write `verification-hints.md` (default true). Disable with `false` or `YT_TRANSCRIPT_VERIFICATION_HINTS=0`.
     */
    verificationHints?: boolean;
    /**
     * Download merged video and extract JPEG stills under `keyframes/` (heavy). Enable with `true` or `YT_TRANSCRIPT_KEY_FRAMES=1`.
     */
    keyFrames?: boolean;
    /** Max stills when key frames enabled (default 24; env `YT_TRANSCRIPT_KEY_FRAME_MAX`). */
    keyFrameMax?: number;
    /** Minimum spacing between stills in seconds (default 45; env `YT_TRANSCRIPT_KEY_FRAME_MIN_INTERVAL_SEC`). */
    keyFrameMinIntervalSec?: number;
};

export type AgentArtifactPaths = {
    artifactDir: string;
    transcriptPath: string;
    summaryPromptPath: string;
    summaryPath: string;
    manifestPath: string;
    cursorHandoffPath: string;
};

export type AgentWorkflowManifest = {
    generatedAt: string;
    videoUrl: string;
    videoId: string;
    videoTitle: string;
    /** Full page description from YouTube (always); may be omitted from `transcript.md` YAML when misaligned. */
    videoDescription: string;
    /** Lexical overlap heuristic: `low` means promo/unrelated page text vs spoken transcript. */
    videoDescriptionAlignment: VideoDescriptionAlignment;
    videoDescriptionLexicalOverlap: number;
    videoDescriptionTokenCount: number;
    /** True when description was dropped from `transcript.md` front matter due to low overlap. */
    videoDescriptionOmittedFromTranscriptYaml: boolean;
    /** `always_include` keeps YAML description even when lexical alignment is `low`. */
    videoDescriptionAlignmentPolicy: DescriptionAlignmentPolicy;
    transcriptFormat: 'md';
    transcriptSource: TranscriptMeta['source'];
    transcriptLanguage?: string;
    /** UTF-16 code units; full transcript.md size (includes YAML front matter). */
    transcriptFileChars: number;
    /** UTF-16 code units; timestamped body only (excludes front matter when present). */
    transcriptBodyChars: number;
    transcriptPath: string;
    summaryPromptPath: string;
    summaryPath: string;
    /** Optional UX file with copy-paste steps for Cursor chat (same folder as other artifacts). */
    cursorHandoffPath: string;
    replyLanguage: string;
    /** Present when verification hints file was written. */
    verificationHintsPath?: string;
    /** Present when key frames were requested; `files` may be empty if sampling yielded no times. */
    keyFrames?: {
        enabled: true;
        directory: string;
        files: string[];
        timesSec: number[];
    };
};

export type AgentWorkflowResult = AgentWorkflowManifest &
    AgentArtifactPaths & {
        workDir?: string;
    };

export function assembleSummaryPrompt(
    template: string,
    transcript: string,
    lang?: SummaryOutputLanguageConfig,
    supplementaryContext?: string
): string {
    const promptBlock = template.includes('\n---\n')
        ? template.split('\n---\n').slice(1).join('\n---\n').trimStart()
        : template;
    if (!promptBlock.includes('{{TRANSCRIPT}}')) {
        throw new Error('Prompt template must contain {{TRANSCRIPT}} placeholder');
    }
    const variables = {
        ...promptTemplateVariables(transcript, lang),
        SUPPLEMENTARY_CONTEXT: (supplementaryContext ?? '').trim()
    };
    let rendered = promptBlock;
    for (const [key, value] of Object.entries(variables)) {
        rendered = rendered.replaceAll(`{{${key}}}`, value);
    }
    return rendered;
}

async function loadPromptTemplate(): Promise<string> {
    return readFile(PROMPT_TEMPLATE_PATH, 'utf8');
}

/** Removes files written during a failed prepare run (newest first). */
export async function rollbackAgentArtifactFiles(paths: readonly string[]): Promise<void> {
    const failures: string[] = [];
    for (const p of [...paths].reverse()) {
        try {
            await unlink(p);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            failures.push(`${p}: ${msg}`);
        }
    }
    if (failures.length > 0) {
        console.warn(
            `[agent-workflow] rollback: failed to remove ${failures.length} file(s):\n${failures.join('\n')}`
        );
    }
}

function resolveArtifactPaths(
    artifactsDir: string,
    videoId: string,
    lang: SummaryOutputLanguageConfig
): AgentArtifactPaths {
    const artifactDir = path.join(artifactsDir, videoId);
    return {
        artifactDir,
        transcriptPath: path.join(artifactDir, 'transcript.md'),
        summaryPromptPath: path.join(artifactDir, 'summary-prompt.md'),
        summaryPath: path.join(artifactDir, summaryFileName(lang)),
        manifestPath: path.join(artifactDir, 'manifest.json'),
        cursorHandoffPath: path.join(artifactDir, CURSOR_HANDOFF_BASENAME)
    };
}

export type CursorHandoffInput = {
    videoTitle: string;
    videoUrl: string;
    videoId: string;
    replyLanguage: string;
    summaryBasename: string;
    repoRootAssumed: string;
    paths: {
        artifactDir: string;
        manifestPath: string;
        summaryPromptPath: string;
        summaryPath: string;
        transcriptPath: string;
        cursorHandoffPath: string;
    };
    /** Extra `- ...` lines under **Paths (absolute)** (optional artifacts). */
    optionalPathBullets?: string[];
};

/** Markdown copy-paste instructions for Cursor chat (no `YT_SUMMARY_CMD`). */
export function buildCursorHandoffMarkdown(input: CursorHandoffInput): string {
    const p = input.paths;
    const abs = (x: string) => path.resolve(x);
    const summaryQuoted = JSON.stringify(abs(p.summaryPath));
    const checkLang =
        input.replyLanguage === 'ru'
            ? `npm run agent:check-summary -- ${summaryQuoted}`
            : `npm run agent:check-summary -- ${summaryQuoted} --reply-lang ${input.replyLanguage}`;

    return [
        '# Cursor handoff',
        '',
        'This file was generated by `agent:prepare`. **You do not need `YT_SUMMARY_CMD`** when you finish the summary in Cursor chat using the steps below.',
        '',
        `## Video`,
        '',
        `- ${JSON.stringify(input.videoTitle)} (video id: \`${input.videoId}\`)`,
        `- URL: ${input.videoUrl}`,
        '',
        `## Paths (absolute)`,
        '',
        `- Artifact folder: \`${abs(p.artifactDir)}\``,
        `- \`manifest.json\`: \`${abs(p.manifestPath)}\``,
        `- \`summary-prompt.md\`: \`${abs(p.summaryPromptPath)}\``,
        `- Target summary file: \`${abs(p.summaryPath)}\` (preset: **${input.replyLanguage}** / \`${input.summaryBasename}\`)`,
        `- \`transcript.md\` (fallback): \`${abs(p.transcriptPath)}\``,
        ...(input.optionalPathBullets?.length
            ? ['', ...input.optionalPathBullets.map((line) => `- ${line}`)]
            : []),
        '',
        `## Steps for the chat agent`,
        '',
        `1. Read \`${abs(p.manifestPath)}\` (context sizing: \`transcriptFileChars\`, \`transcriptBodyChars\`, \`videoDescription\`).`,
        `2. Read \`${abs(p.summaryPromptPath)}\`.`,
        `3. Write the structured handoff to \`${abs(p.summaryPath)}\` using only the transcript (and description where allowed).`,
        `4. Run: \`${checkLang}\``,
        `5. On validation failure, fix \`${path.basename(p.summaryPath)}\` and repeat step 4.`,
        '',
        `Commands assume the repo root is \`${input.repoRootAssumed}\` (where \`package.json\` lives).`,
        ''
    ].join('\n');
}

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
    const n = Number.parseInt(value ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function wantVerificationHints(options: AgentWorkflowOptions): boolean {
    if (options.verificationHints === false) {
        return false;
    }
    const v = process.env.YT_TRANSCRIPT_VERIFICATION_HINTS?.trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'no') {
        return false;
    }
    return true;
}

function wantKeyFrames(options: AgentWorkflowOptions): boolean {
    if (options.keyFrames === true) {
        return true;
    }
    const v = process.env.YT_TRANSCRIPT_KEY_FRAMES?.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
}

function keyFrameLimits(options: AgentWorkflowOptions): {
    maxFrames: number;
    minIntervalSec: number;
} {
    return {
        maxFrames:
            options.keyFrameMax ?? parsePositiveIntEnv(process.env.YT_TRANSCRIPT_KEY_FRAME_MAX, 24),
        minIntervalSec:
            options.keyFrameMinIntervalSec ??
            parsePositiveIntEnv(process.env.YT_TRANSCRIPT_KEY_FRAME_MIN_INTERVAL_SEC, 45)
    };
}

function formatApproxTimestamp(sec: number): string {
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

function buildSupplementaryContextMarkdown(parts: {
    verificationHintsRelative?: string;
    keyFrames?: { directory: string; files: string[]; timesSec: number[] };
}): string {
    const blocks: string[] = [];
    if (parts.verificationHintsRelative) {
        blocks.push(
            `### Verification and link hints\n\nRead \`${parts.verificationHintsRelative}\` in this artifact folder. It lists http(s) URLs from the page description and sample transcript timestamps for fact-checking (no network I/O in this repo).`
        );
    }
    if (parts.keyFrames?.files.length) {
        const rel = parts.keyFrames.directory;
        const lines = parts.keyFrames.files.map((f, i) => {
            const t = parts.keyFrames!.timesSec[i] ?? 0;
            return `- \`${rel}/${f}\` (~${formatApproxTimestamp(t)})`;
        });
        blocks.push(
            `### Key frame stills (ffmpeg)\n\nOptional JPEGs captured near cue times. Use them to notice **on-screen** text or UI the transcript may omit; do not invent unreadable detail.\n\n${lines.join('\n')}`
        );
    }
    if (blocks.length === 0) {
        return '';
    }
    return ['## Supplementary pipeline context', '', ...blocks].join('\n\n');
}

export async function prepareAgentWorkflow(
    options: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
    const videoInfo = await fetchVideoInfo(options.url);
    const lang = resolveSummaryOutputLanguage(options.replyLanguage);
    const artifactsDir = path.resolve(process.cwd(), options.artifactsDir ?? DEFAULT_ARTIFACTS_DIR);
    const artifactPaths = resolveArtifactPaths(artifactsDir, videoInfo.id, lang);

    await mkdir(artifactPaths.artifactDir, { recursive: true });

    /** Paths created in this invocation; removed on failure so the bundle stays consistent. */
    const writtenArtifactPaths: string[] = [];

    try {
        const pipelineResult = await runPipeline({
            url: options.url,
            videoInfo,
            outputPath: artifactPaths.transcriptPath,
            format: 'md',
            forceWhisper: options.forceWhisper ?? false,
            minSubtitleChars: options.minSubtitleChars ?? 80,
            audioFormat: options.audioFormat ?? 'm4a',
            whisperCommand: options.whisperCommand ?? DEFAULT_WHISPER_CMD,
            keepWorkDir: options.keepWorkDir ?? false,
            descriptionAlignment: options.descriptionAlignment
        });
        writtenArtifactPaths.push(artifactPaths.transcriptPath);

        let verificationHintsRelative: string | undefined;
        const verificationPath = path.join(artifactPaths.artifactDir, VERIFICATION_HINTS_BASENAME);
        if (wantVerificationHints(options)) {
            const hintsMd = buildVerificationHintsMarkdown({
                videoUrl: options.url,
                pageDescription: videoInfo.description,
                segments: pipelineResult.segments,
                maxAnchors: 24
            });
            await writeFile(verificationPath, hintsMd, 'utf8');
            writtenArtifactPaths.push(verificationPath);
            verificationHintsRelative = VERIFICATION_HINTS_BASENAME;
        }

        let keyFrameBundle:
            | { enabled: true; directory: string; files: string[]; timesSec: number[] }
            | undefined;
        if (wantKeyFrames(options) && pipelineResult.segments.length > 0) {
            const { maxFrames, minIntervalSec } = keyFrameLimits(options);
            const kf = await downloadVideoAndExtractKeyFrames({
                url: options.url,
                videoId: videoInfo.id,
                segments: pipelineResult.segments,
                artifactDir: artifactPaths.artifactDir,
                maxFrames,
                minIntervalSec
            });
            for (const f of kf.files) {
                writtenArtifactPaths.push(path.join(artifactPaths.artifactDir, kf.relativeDir, f));
            }
            if (kf.files.length > 0) {
                keyFrameBundle = {
                    enabled: true,
                    directory: kf.relativeDir,
                    files: kf.files,
                    timesSec: kf.timesSec
                };
            }
        }

        const [template, transcript] = await Promise.all([
            loadPromptTemplate(),
            readFile(artifactPaths.transcriptPath, 'utf8')
        ]);
        const charMetrics = computeTranscriptCharMetrics(transcript);
        const supplementary = buildSupplementaryContextMarkdown({
            verificationHintsRelative,
            keyFrames: keyFrameBundle?.files.length ? keyFrameBundle : undefined
        });
        const prompt = assembleSummaryPrompt(template, transcript, lang, supplementary);
        await writeFile(artifactPaths.summaryPromptPath, prompt, 'utf8');
        writtenArtifactPaths.push(artifactPaths.summaryPromptPath);

        const manifest: AgentWorkflowManifest = {
            generatedAt: new Date().toISOString(),
            videoUrl: options.url,
            videoId: videoInfo.id,
            videoTitle: videoInfo.title,
            videoDescription: videoInfo.description,
            videoDescriptionAlignment: pipelineResult.videoDescriptionAlignment,
            videoDescriptionLexicalOverlap: pipelineResult.videoDescriptionLexicalOverlap,
            videoDescriptionTokenCount: pipelineResult.videoDescriptionTokenCount,
            videoDescriptionOmittedFromTranscriptYaml:
                pipelineResult.videoDescriptionOmittedFromTranscriptYaml,
            videoDescriptionAlignmentPolicy: pipelineResult.videoDescriptionAlignmentPolicy,
            transcriptFormat: 'md',
            transcriptSource: pipelineResult.meta.source,
            transcriptLanguage: pipelineResult.meta.language,
            transcriptFileChars: charMetrics.fileChars,
            transcriptBodyChars: charMetrics.bodyChars,
            transcriptPath: artifactPaths.transcriptPath,
            summaryPromptPath: artifactPaths.summaryPromptPath,
            summaryPath: artifactPaths.summaryPath,
            cursorHandoffPath: artifactPaths.cursorHandoffPath,
            replyLanguage: lang.code,
            ...(verificationHintsRelative ? { verificationHintsPath: verificationPath } : {}),
            ...(keyFrameBundle ? { keyFrames: keyFrameBundle } : {})
        };
        await writeFile(
            artifactPaths.manifestPath,
            `${JSON.stringify(manifest, null, 4)}\n`,
            'utf8'
        );
        writtenArtifactPaths.push(artifactPaths.manifestPath);

        const abs = (x: string) => path.resolve(x);
        const optionalPathBullets: string[] = [];
        if (verificationHintsRelative) {
            optionalPathBullets.push(
                `Optional verification hints: \`${abs(verificationPath)}\` (URLs + time anchors; no network)`
            );
        }
        if (keyFrameBundle?.files.length) {
            optionalPathBullets.push(
                `Optional key frame stills: \`${abs(path.join(artifactPaths.artifactDir, keyFrameBundle.directory))}/\``
            );
        }

        const handoffMd = buildCursorHandoffMarkdown({
            videoTitle: videoInfo.title,
            videoUrl: options.url,
            videoId: videoInfo.id,
            replyLanguage: lang.code,
            summaryBasename: path.basename(artifactPaths.summaryPath),
            repoRootAssumed: process.cwd(),
            paths: {
                artifactDir: artifactPaths.artifactDir,
                manifestPath: artifactPaths.manifestPath,
                summaryPromptPath: artifactPaths.summaryPromptPath,
                summaryPath: artifactPaths.summaryPath,
                transcriptPath: artifactPaths.transcriptPath,
                cursorHandoffPath: artifactPaths.cursorHandoffPath
            },
            optionalPathBullets: optionalPathBullets.length > 0 ? optionalPathBullets : undefined
        });
        await writeFile(artifactPaths.cursorHandoffPath, handoffMd, 'utf8');
        writtenArtifactPaths.push(artifactPaths.cursorHandoffPath);

        return {
            ...artifactPaths,
            ...manifest,
            workDir: pipelineResult.workDir
        };
    } catch (err) {
        await rollbackAgentArtifactFiles(writtenArtifactPaths);
        await rm(path.join(artifactPaths.artifactDir, 'keyframes'), {
            recursive: true,
            force: true
        }).catch(() => undefined);
        throw err;
    }
}
