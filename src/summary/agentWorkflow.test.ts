import * as fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mkdtemp, readFile, rm, writeFile } = fsPromises;

const pipeline = vi.hoisted(() => ({
    runPipeline: vi.fn()
}));

const yt = vi.hoisted(() => ({
    fetchVideoInfo: vi.fn()
}));

vi.mock('@/pipeline/pipeline', () => ({
    runPipeline: pipeline.runPipeline
}));

vi.mock('@/pipeline/ytDlp', () => ({
    fetchVideoInfo: yt.fetchVideoInfo
}));

import {
    assembleSummaryPrompt,
    buildCursorHandoffMarkdown,
    prepareAgentWorkflow,
    rollbackAgentArtifactFiles
} from '@/summary/agentWorkflow';
import { SUMMARY_LANGUAGE_PRESETS, summaryFileName } from '@/summary/outputLanguage';

describe('assembleSummaryPrompt', () => {
    it('replaces transcript placeholder', () => {
        const prompt = assembleSummaryPrompt(
            'Before\n{{OUTPUT_LANGUAGE_NAME}}\n{{TRANSCRIPT}}\nAfter',
            'hello\n'
        );

        expect(prompt).toBe('Before\nRussian\nhello\nAfter');
    });

    it('throws when the placeholder is missing', () => {
        expect(() => assembleSummaryPrompt('No placeholder', 'hello')).toThrow(
            'Prompt template must contain {{TRANSCRIPT}} placeholder'
        );
    });

    it('uses English preset variables when lang is en', () => {
        const prompt = assembleSummaryPrompt(
            'Front\n---\n{{OUTPUT_LANGUAGE_NAME}}\n{{TRANSCRIPT}}',
            'line\n',
            SUMMARY_LANGUAGE_PRESETS.en
        );
        expect(prompt).toContain('English');
        expect(prompt).toContain('line');
        expect(prompt).not.toContain('{{TRANSCRIPT}}');
    });
});

describe('prepareAgentWorkflow', () => {
    let tempDir: string;
    let artifactsDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        tempDir = await mkdtemp(path.join(os.tmpdir(), 'agent-workflow-test-'));
        artifactsDir = path.join(tempDir, 'artifacts');
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('writes transcript, summary prompt, and manifest with summary path', async () => {
        const url = 'https://www.youtube.com/watch?v=abc123';
        const transcript = `---
source: subtitle-auto
video_id: abc123
title: "Amazing video"
language: en
---

**[00:00]** Hello there
`;

        yt.fetchVideoInfo.mockResolvedValue({
            id: 'abc123',
            title: 'Amazing video',
            description: ''
        });
        pipeline.runPipeline.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
            await writeFile(outputPath, transcript, 'utf8');
            return {
                writtenPath: outputPath,
                meta: {
                    source: 'subtitle-auto' as const,
                    language: 'en',
                    videoId: 'abc123',
                    title: 'Amazing video'
                },
                segments: [{ startSec: 0, endSec: 1, text: 'Hello there' }],
                segmentCount: 1,
                videoDescriptionAlignment: 'high',
                videoDescriptionLexicalOverlap: 1,
                videoDescriptionTokenCount: 0,
                videoDescriptionOmittedFromTranscriptYaml: false,
                videoDescriptionAlignmentPolicy: 'heuristic'
            };
        });

        const result = await prepareAgentWorkflow({ url, artifactsDir, verificationHints: false });

        expect(result.artifactDir).toBe(path.join(artifactsDir, 'abc123'));
        expect(result.transcriptPath).toBe(path.join(artifactsDir, 'abc123', 'transcript.md'));
        expect(result.summaryPromptPath).toBe(
            path.join(artifactsDir, 'abc123', 'summary-prompt.md')
        );
        expect(result.summaryPath).toBe(path.join(artifactsDir, 'abc123', summaryFileName()));
        expect(result.manifestPath).toBe(path.join(artifactsDir, 'abc123', 'manifest.json'));
        expect(result.cursorHandoffPath).toBe(
            path.join(artifactsDir, 'abc123', 'cursor-handoff.md')
        );
        expect(result.transcriptSource).toBe('subtitle-auto');
        expect(result.transcriptLanguage).toBe('en');
        expect(result.replyLanguage).toBe('ru');

        expect(pipeline.runPipeline).toHaveBeenCalledWith(
            expect.objectContaining({
                url,
                outputPath: path.join(artifactsDir, 'abc123', 'transcript.md'),
                format: 'md',
                minSubtitleChars: 80,
                audioFormat: 'm4a',
                forceWhisper: false
            })
        );

        const prompt = await readFile(result.summaryPromptPath, 'utf8');
        expect(prompt).toContain('**[00:00]** Hello there');
        expect(prompt).not.toContain('{{TRANSCRIPT}}');

        const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8')) as {
            replyLanguage: string;
            summaryPath: string;
            summaryPromptPath: string;
            transcriptPath: string;
            cursorHandoffPath: string;
            transcriptFileChars: number;
            transcriptBodyChars: number;
            videoDescription: string;
            videoDescriptionAlignment: string;
            videoDescriptionLexicalOverlap: number;
            videoDescriptionTokenCount: number;
            videoDescriptionOmittedFromTranscriptYaml: boolean;
            videoDescriptionAlignmentPolicy: string;
        };
        expect(manifest.transcriptPath).toBe(result.transcriptPath);
        expect(manifest.summaryPromptPath).toBe(result.summaryPromptPath);
        expect(manifest.summaryPath).toBe(result.summaryPath);
        expect(manifest.cursorHandoffPath).toBe(result.cursorHandoffPath);

        const handoff = await readFile(result.cursorHandoffPath, 'utf8');
        expect(handoff).toContain('You do not need `YT_SUMMARY_CMD`');
        expect(handoff).toContain(path.resolve(result.summaryPath));
        expect(handoff).toContain('agent:check-summary');
        expect(manifest.replyLanguage).toBe('ru');
        expect(manifest.videoDescription).toBe('');
        expect(manifest.videoDescriptionAlignment).toBe('high');
        expect(manifest.videoDescriptionLexicalOverlap).toBe(1);
        expect(manifest.videoDescriptionTokenCount).toBe(0);
        expect(manifest.videoDescriptionOmittedFromTranscriptYaml).toBe(false);
        expect(manifest.videoDescriptionAlignmentPolicy).toBe('heuristic');
        expect(manifest.transcriptFileChars).toBe(transcript.length);
        expect(manifest.transcriptBodyChars).toBeLessThan(manifest.transcriptFileChars);
        expect(manifest.transcriptBodyChars).toBeGreaterThan(0);
    });

    it('writes summary.en.md when replyLanguage is en', async () => {
        const url = 'https://www.youtube.com/watch?v=xyz999';
        const transcript = `---
source: subtitle-manual
video_id: xyz999
title: "Test"
---

**[00:00]** Hi
`;

        yt.fetchVideoInfo.mockResolvedValue({
            id: 'xyz999',
            title: 'Test',
            description: ''
        });
        pipeline.runPipeline.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
            await writeFile(outputPath, transcript, 'utf8');
            return {
                writtenPath: outputPath,
                meta: {
                    source: 'subtitle-manual' as const,
                    videoId: 'xyz999',
                    title: 'Test'
                },
                segments: [{ startSec: 0, endSec: 1, text: 'Hi' }],
                segmentCount: 1,
                videoDescriptionAlignment: 'high',
                videoDescriptionLexicalOverlap: 1,
                videoDescriptionTokenCount: 0,
                videoDescriptionOmittedFromTranscriptYaml: false,
                videoDescriptionAlignmentPolicy: 'heuristic'
            };
        });

        const result = await prepareAgentWorkflow({
            url,
            artifactsDir,
            replyLanguage: 'en',
            verificationHints: false
        });

        expect(result.replyLanguage).toBe('en');
        expect(result.summaryPath).toBe(
            path.join(artifactsDir, 'xyz999', summaryFileName(SUMMARY_LANGUAGE_PRESETS.en))
        );
        const prompt = await readFile(result.summaryPromptPath, 'utf8');
        expect(prompt).toContain('## What the video is about');
    });

    it('writes verification-hints.md and supplementary context when hints are enabled', async () => {
        const url = 'https://www.youtube.com/watch?v=vh1';
        const transcript = `---
source: subtitle-auto
video_id: vh1
title: "T"
---

**[00:00]** Hi
`;

        yt.fetchVideoInfo.mockResolvedValue({
            id: 'vh1',
            title: 'T',
            description: 'Link https://example.com/doc'
        });
        pipeline.runPipeline.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
            await writeFile(outputPath, transcript, 'utf8');
            return {
                writtenPath: outputPath,
                meta: {
                    source: 'subtitle-auto' as const,
                    videoId: 'vh1',
                    title: 'T'
                },
                segments: [{ startSec: 0, endSec: 1, text: 'Hi' }],
                segmentCount: 1,
                videoDescriptionAlignment: 'high',
                videoDescriptionLexicalOverlap: 1,
                videoDescriptionTokenCount: 2,
                videoDescriptionOmittedFromTranscriptYaml: false,
                videoDescriptionAlignmentPolicy: 'heuristic'
            };
        });

        const result = await prepareAgentWorkflow({ url, artifactsDir });

        const hintsPath = path.join(artifactsDir, 'vh1', 'verification-hints.md');
        const hints = await readFile(hintsPath, 'utf8');
        expect(hints).toContain('https://example.com/doc');

        const prompt = await readFile(result.summaryPromptPath, 'utf8');
        expect(prompt).toContain('Supplementary pipeline context');
        expect(prompt).toContain('verification-hints.md');

        const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8')) as {
            verificationHintsPath?: string;
        };
        expect(manifest.verificationHintsPath).toBeDefined();
    });
});

describe('buildCursorHandoffMarkdown', () => {
    it('includes check-summary with --reply-lang when not ru', () => {
        const md = buildCursorHandoffMarkdown({
            videoTitle: 'T',
            videoUrl: 'https://www.youtube.com/watch?v=a',
            videoId: 'a',
            replyLanguage: 'en',
            summaryBasename: 'summary.en.md',
            repoRootAssumed: '/repo',
            paths: {
                artifactDir: '/repo/art/vid',
                manifestPath: '/repo/art/vid/manifest.json',
                summaryPromptPath: '/repo/art/vid/summary-prompt.md',
                summaryPath: '/repo/art/vid/summary.en.md',
                transcriptPath: '/repo/art/vid/transcript.md',
                cursorHandoffPath: '/repo/art/vid/cursor-handoff.md'
            }
        });
        expect(md).toContain('--reply-lang en');
        expect(md).not.toContain('--reply-lang ru');
    });
});

describe('rollbackAgentArtifactFiles', () => {
    it('removes listed paths', async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), 'agent-rollback-test-'));
        try {
            const a = path.join(dir, 'a.md');
            const b = path.join(dir, 'b.md');
            await writeFile(a, 'a', 'utf8');
            await writeFile(b, 'b', 'utf8');

            await rollbackAgentArtifactFiles([a, b]);

            await expect(fsPromises.access(a)).rejects.toMatchObject({ code: 'ENOENT' });
            await expect(fsPromises.access(b)).rejects.toMatchObject({ code: 'ENOENT' });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
