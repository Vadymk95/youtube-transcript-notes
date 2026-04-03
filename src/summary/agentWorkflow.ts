import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPipeline } from '@/pipeline/pipeline';
import { DEFAULT_WHISPER_CMD } from '@/pipeline/whisperFallback';
import { fetchVideoInfo } from '@/pipeline/ytDlp';
import {
    DEFAULT_REPLY_LANGUAGE,
    promptTemplateVariables,
    summaryFileName
} from '@/summary/outputLanguage';
import type { TranscriptMeta } from '@/transcript/types';

export const DEFAULT_ARTIFACTS_DIR = path.join('artifacts', 'videos');

const PROMPT_TEMPLATE_PATH = fileURLToPath(
    new URL('../../prompts/video-notes-prompt.md', import.meta.url)
);

export type AgentWorkflowOptions = {
    url: string;
    artifactsDir?: string;
    forceWhisper?: boolean;
    minSubtitleChars?: number;
    audioFormat?: string;
    whisperCommand?: string;
    keepWorkDir?: boolean;
};

export type AgentArtifactPaths = {
    artifactDir: string;
    transcriptPath: string;
    summaryPromptPath: string;
    summaryPath: string;
    manifestPath: string;
};

export type AgentWorkflowManifest = {
    generatedAt: string;
    videoUrl: string;
    videoId: string;
    videoTitle: string;
    transcriptFormat: 'md';
    transcriptSource: TranscriptMeta['source'];
    transcriptLanguage?: string;
    transcriptPath: string;
    summaryPromptPath: string;
    summaryPath: string;
    replyLanguage: typeof DEFAULT_REPLY_LANGUAGE;
};

export type AgentWorkflowResult = AgentWorkflowManifest &
    AgentArtifactPaths & {
        workDir?: string;
    };

export function assembleSummaryPrompt(template: string, transcript: string): string {
    const promptBlock = template.includes('\n---\n')
        ? template.split('\n---\n').slice(1).join('\n---\n').trimStart()
        : template;
    if (!promptBlock.includes('{{TRANSCRIPT}}')) {
        throw new Error('Prompt template must contain {{TRANSCRIPT}} placeholder');
    }
    const variables = promptTemplateVariables(transcript);
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

function resolveArtifactPaths(artifactsDir: string, videoId: string): AgentArtifactPaths {
    const artifactDir = path.join(artifactsDir, videoId);
    return {
        artifactDir,
        transcriptPath: path.join(artifactDir, 'transcript.md'),
        summaryPromptPath: path.join(artifactDir, 'summary-prompt.md'),
        summaryPath: path.join(artifactDir, summaryFileName()),
        manifestPath: path.join(artifactDir, 'manifest.json')
    };
}

export async function prepareAgentWorkflow(
    options: AgentWorkflowOptions
): Promise<AgentWorkflowResult> {
    const videoInfo = await fetchVideoInfo(options.url);
    const artifactsDir = path.resolve(process.cwd(), options.artifactsDir ?? DEFAULT_ARTIFACTS_DIR);
    const artifactPaths = resolveArtifactPaths(artifactsDir, videoInfo.id);

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
            keepWorkDir: options.keepWorkDir ?? false
        });
        writtenArtifactPaths.push(artifactPaths.transcriptPath);

        const [template, transcript] = await Promise.all([
            loadPromptTemplate(),
            readFile(artifactPaths.transcriptPath, 'utf8')
        ]);
        const prompt = assembleSummaryPrompt(template, transcript);
        await writeFile(artifactPaths.summaryPromptPath, prompt, 'utf8');
        writtenArtifactPaths.push(artifactPaths.summaryPromptPath);

        const manifest: AgentWorkflowManifest = {
            generatedAt: new Date().toISOString(),
            videoUrl: options.url,
            videoId: videoInfo.id,
            videoTitle: videoInfo.title,
            transcriptFormat: 'md',
            transcriptSource: pipelineResult.meta.source,
            transcriptLanguage: pipelineResult.meta.language,
            transcriptPath: artifactPaths.transcriptPath,
            summaryPromptPath: artifactPaths.summaryPromptPath,
            summaryPath: artifactPaths.summaryPath,
            replyLanguage: DEFAULT_REPLY_LANGUAGE
        };
        await writeFile(
            artifactPaths.manifestPath,
            `${JSON.stringify(manifest, null, 4)}\n`,
            'utf8'
        );
        writtenArtifactPaths.push(artifactPaths.manifestPath);

        return {
            ...artifactPaths,
            ...manifest,
            workDir: pipelineResult.workDir
        };
    } catch (err) {
        await rollbackAgentArtifactFiles(writtenArtifactPaths);
        throw err;
    }
}
