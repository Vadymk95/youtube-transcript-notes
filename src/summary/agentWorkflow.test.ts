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
    prepareAgentWorkflow,
    rollbackAgentArtifactFiles
} from '@/summary/agentWorkflow';
import { summaryFileName } from '@/summary/outputLanguage';

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
                segmentCount: 1
            };
        });

        const result = await prepareAgentWorkflow({ url, artifactsDir });

        expect(result.artifactDir).toBe(path.join(artifactsDir, 'abc123'));
        expect(result.transcriptPath).toBe(path.join(artifactsDir, 'abc123', 'transcript.md'));
        expect(result.summaryPromptPath).toBe(
            path.join(artifactsDir, 'abc123', 'summary-prompt.md')
        );
        expect(result.summaryPath).toBe(path.join(artifactsDir, 'abc123', summaryFileName()));
        expect(result.manifestPath).toBe(path.join(artifactsDir, 'abc123', 'manifest.json'));
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
            transcriptFileChars: number;
            transcriptBodyChars: number;
            videoDescription: string;
        };
        expect(manifest.transcriptPath).toBe(result.transcriptPath);
        expect(manifest.summaryPromptPath).toBe(result.summaryPromptPath);
        expect(manifest.summaryPath).toBe(result.summaryPath);
        expect(manifest.replyLanguage).toBe('ru');
        expect(manifest.videoDescription).toBe('');
        expect(manifest.transcriptFileChars).toBe(transcript.length);
        expect(manifest.transcriptBodyChars).toBeLessThan(manifest.transcriptFileChars);
        expect(manifest.transcriptBodyChars).toBeGreaterThan(0);
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
