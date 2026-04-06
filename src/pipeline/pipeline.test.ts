import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const yt = vi.hoisted(() => ({
    downloadManualSubs: vi.fn(),
    downloadAutoSubs: vi.fn(),
    downloadAudio: vi.fn(),
    fetchVideoInfo: vi.fn()
}));

const wf = vi.hoisted(() => ({
    assertWhisperCommandResolvable: vi.fn(),
    runWhisperToVtt: vi.fn(),
    loadSegmentsFromVttFile: vi.fn()
}));

vi.mock('@/pipeline/ytDlp', () => ({
    downloadManualSubs: yt.downloadManualSubs,
    downloadAutoSubs: yt.downloadAutoSubs,
    downloadAudio: yt.downloadAudio,
    fetchVideoInfo: yt.fetchVideoInfo
}));

vi.mock('@/pipeline/whisperFallback', () => ({
    assertWhisperCommandResolvable: wf.assertWhisperCommandResolvable,
    runWhisperToVtt: wf.runWhisperToVtt,
    loadSegmentsFromVttFile: wf.loadSegmentsFromVttFile
}));

import { runPipeline } from '@/pipeline/pipeline';

const longVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
${'x'.repeat(100)}
`;

const shortVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
Hi
`;

const mediumVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
${'a'.repeat(50)}
`;

const tinyVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
hello
`;

const videoInfo = { id: 'vid', title: 'Test video', description: '' };

function baseOptions(outputPath: string) {
    return {
        url: 'https://www.youtube.com/watch?v=test',
        videoInfo,
        outputPath,
        format: 'md' as const,
        forceWhisper: false,
        minSubtitleChars: 80,
        audioFormat: 'm4a',
        whisperCommand: 'whisper {{audio}} --output_dir {{outdir}}',
        keepWorkDir: false
    };
}

describe('runPipeline', () => {
    let outDir: string;
    let outFile: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        wf.assertWhisperCommandResolvable.mockResolvedValue(undefined);
        outDir = await mkdtemp(path.join(os.tmpdir(), 'pipeline-test-'));
        outFile = path.join(outDir, 'out.md');
    });

    afterEach(async () => {
        await rm(outDir, { recursive: true, force: true });
    });

    it('uses manual subs when score meets minSubtitleChars', async () => {
        yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'manual-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, longVtt, 'utf8');
            return { kind: 'manual' as const, files: [p] };
        });
        yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });

        const result = await runPipeline(baseOptions(outFile));

        expect(result.meta.source).toBe('subtitle-manual');
        expect(result.meta.language).toBe('en');
        expect(result.meta.videoId).toBe('vid');
        expect(result.meta.title).toBe('Test video');
        expect(result.videoDescriptionAlignment).toBe('high');
        expect(result.videoDescriptionAlignmentPolicy).toBe('heuristic');
        expect(result.videoDescriptionOmittedFromTranscriptYaml).toBe(false);
        expect(result.segmentCount).toBe(1);
        expect(yt.downloadAudio).not.toHaveBeenCalled();
        expect(wf.runWhisperToVtt).not.toHaveBeenCalled();

        const body = await readFile(outFile, 'utf8');
        expect(body).toContain('source: subtitle-manual');
        expect(body).toContain('**[00:00]**');
    });

    it('embeds video description in transcript front matter when provided', async () => {
        yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'manual-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, longVtt, 'utf8');
            return { kind: 'manual' as const, files: [p] };
        });
        yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });

        await runPipeline({
            ...baseOptions(outFile),
            videoInfo: { id: 'vid', title: 'Test video', description: 'See https://x.test' }
        });

        const body = await readFile(outFile, 'utf8');
        expect(body).toContain('description: ');
        expect(body).toContain('https://x.test');
    });

    it('omits misaligned page description from markdown YAML but keeps meta.description', async () => {
        yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'manual-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            const elephantVtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
The elephants at the zoo are amazing we love watching them eat hay and play with each other the zookeeper brings fresh water daily
`;
            await writeFile(p, elephantVtt, 'utf8');
            return { kind: 'manual' as const, files: [p] };
        });
        yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });

        const spamDesc =
            'Microplastic pollution harms marine wildlife ecosystems worldwide scientists discovered shocking contamination levels in oceans urgent action required additional research studies demonstrate persistent organic pollutants bioaccumulation in food chains visit https://youtube.com/foo';

        const result = await runPipeline({
            ...baseOptions(outFile),
            videoInfo: { id: 'vid', title: 'Test video', description: spamDesc }
        });

        expect(result.meta.description).toBe(spamDesc);
        expect(result.videoDescriptionAlignment).toBe('low');
        expect(result.videoDescriptionAlignmentPolicy).toBe('heuristic');
        expect(result.videoDescriptionOmittedFromTranscriptYaml).toBe(true);

        const body = await readFile(outFile, 'utf8');
        expect(body).not.toContain('Microplastic');
        expect(body).not.toContain('description:');
        expect(body).toContain('elephants');
    });

    it('keeps yaml description when YT_TRANSCRIPT_DESC_ALIGN_POLICY=always_include', async () => {
        const prev = process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY;
        process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY = 'always_include';
        try {
            yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
                const subDir = path.join(workDir, 'manual-subs');
                await mkdir(subDir, { recursive: true });
                const p = path.join(subDir, 'vid.en.vtt');
                const elephantVtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
The elephants at the zoo are amazing we love watching them eat hay and play with each other the zookeeper brings fresh water daily
`;
                await writeFile(p, elephantVtt, 'utf8');
                return { kind: 'manual' as const, files: [p] };
            });
            yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });

            const spamDesc =
                'Microplastic pollution harms marine wildlife ecosystems worldwide scientists discovered shocking contamination levels in oceans urgent action required additional research studies demonstrate persistent organic pollutants bioaccumulation in food chains visit https://youtube.com/foo';

            const result = await runPipeline({
                ...baseOptions(outFile),
                videoInfo: { id: 'vid', title: 'Test video', description: spamDesc }
            });

            expect(result.videoDescriptionAlignment).toBe('low');
            expect(result.videoDescriptionAlignmentPolicy).toBe('always_include');
            expect(result.videoDescriptionOmittedFromTranscriptYaml).toBe(false);

            const body = await readFile(outFile, 'utf8');
            expect(body).toContain('Microplastic');
        } finally {
            if (prev === undefined) {
                delete process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY;
            } else {
                process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY = prev;
            }
        }
    });

    it('keeps yaml description when descriptionAlignment option is always_include (over env default)', async () => {
        const prevPolicy = process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY;
        delete process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY;
        try {
            yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
                const subDir = path.join(workDir, 'manual-subs');
                await mkdir(subDir, { recursive: true });
                const p = path.join(subDir, 'vid.en.vtt');
                const elephantVtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
The elephants at the zoo are amazing we love watching them eat hay and play with each other the zookeeper brings fresh water daily
`;
                await writeFile(p, elephantVtt, 'utf8');
                return { kind: 'manual' as const, files: [p] };
            });
            yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });

            const spamDesc =
                'Microplastic pollution harms marine wildlife ecosystems worldwide scientists discovered shocking contamination levels in oceans urgent action required additional research studies demonstrate persistent organic pollutants bioaccumulation in food chains visit https://youtube.com/foo';

            const result = await runPipeline({
                ...baseOptions(outFile),
                videoInfo: { id: 'vid', title: 'Test video', description: spamDesc },
                descriptionAlignment: { policy: 'always_include' }
            });

            expect(result.videoDescriptionAlignmentPolicy).toBe('always_include');
            expect(result.videoDescriptionOmittedFromTranscriptYaml).toBe(false);
            const body = await readFile(outFile, 'utf8');
            expect(body).toContain('Microplastic');
        } finally {
            if (prevPolicy === undefined) {
                delete process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY;
            } else {
                process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY = prevPolicy;
            }
        }
    });

    it('uses auto subs when manual is short but auto meets minSubtitleChars', async () => {
        yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'manual-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, shortVtt, 'utf8');
            return { kind: 'manual' as const, files: [p] };
        });
        yt.downloadAutoSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'auto-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.ru.vtt');
            await writeFile(p, longVtt, 'utf8');
            return { kind: 'auto' as const, files: [p] };
        });

        const result = await runPipeline(baseOptions(outFile));

        expect(result.meta.source).toBe('subtitle-auto');
        expect(result.meta.language).toBe('ru');
        expect(yt.downloadAudio).not.toHaveBeenCalled();
    });

    it('collapses YouTube rolling auto captions into one segment per phrase chain', async () => {
        const rollingBase = 'x'.repeat(80);
        const rollingVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
${rollingBase}

00:00:00.500 --> 00:00:02.000
${rollingBase} bb

00:00:01.000 --> 00:00:03.000
${rollingBase} bb cc
`;
        yt.downloadManualSubs.mockResolvedValue({ kind: 'manual', files: [] });
        yt.downloadAutoSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'auto-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, rollingVtt, 'utf8');
            return { kind: 'auto' as const, files: [p] };
        });

        const result = await runPipeline(baseOptions(outFile));

        expect(result.meta.source).toBe('subtitle-auto');
        expect(result.segmentCount).toBe(1);

        const body = await readFile(outFile, 'utf8');
        expect(body).toContain(`${rollingBase} bb cc`);
        const timestampBlocks = body.match(/\*\*\[\d{2}:\d{2}\]\*\*/g);
        expect(timestampBlocks).toHaveLength(1);
    });

    it('deduplicates a sliding text window into a readable phrase', async () => {
        const slidingVtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
alpha beta gamma delta epsilon zeta

00:00:01.500 --> 00:00:03.000
gamma delta epsilon zeta eta theta iota

00:00:02.500 --> 00:00:04.000
epsilon zeta eta theta iota kappa lambda
`;
        yt.downloadManualSubs.mockResolvedValue({ kind: 'manual', files: [] });
        yt.downloadAutoSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'auto-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, slidingVtt, 'utf8');
            return { kind: 'auto' as const, files: [p] };
        });

        const result = await runPipeline(baseOptions(outFile));

        expect(result.meta.source).toBe('subtitle-auto');
        expect(result.segmentCount).toBe(1);

        const body = await readFile(outFile, 'utf8');
        expect(body).toContain('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda');
        const timestampBlocks = body.match(/\*\*\[\d{2}:\d{2}\]\*\*/g);
        expect(timestampBlocks).toHaveLength(1);
    });

    it('falls back to manual when below minChars but manual has text', async () => {
        yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'manual-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.de.vtt');
            await writeFile(p, mediumVtt, 'utf8');
            return { kind: 'manual' as const, files: [p] };
        });
        yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });

        const result = await runPipeline(baseOptions(outFile));

        expect(result.meta.source).toBe('subtitle-manual');
        expect(result.meta.language).toBe('de');
        expect(result.segmentCount).toBe(1);
    });

    it('falls back to auto when manual empty and auto has short text', async () => {
        yt.downloadManualSubs.mockResolvedValue({ kind: 'manual', files: [] });
        yt.downloadAutoSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'auto-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, tinyVtt, 'utf8');
            return { kind: 'auto' as const, files: [p] };
        });

        const result = await runPipeline(baseOptions(outFile));

        expect(result.meta.source).toBe('subtitle-auto');
        expect(result.segmentCount).toBe(1);
    });

    it('runs Whisper path when no usable subs', async () => {
        yt.downloadManualSubs.mockResolvedValue({ kind: 'manual', files: [] });
        yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });
        yt.downloadAudio.mockResolvedValue('/fake/audio.m4a');
        wf.runWhisperToVtt.mockResolvedValue('/fake/out.vtt');
        wf.loadSegmentsFromVttFile.mockResolvedValue([
            { startSec: 0, endSec: 2, text: 'Whisper line' }
        ]);

        const result = await runPipeline(baseOptions(outFile));

        expect(result.meta.source).toBe('whisper');
        expect(result.segmentCount).toBe(1);
        expect(wf.assertWhisperCommandResolvable).toHaveBeenCalledWith(
            'whisper {{audio}} --output_dir {{outdir}}'
        );
        expect(yt.downloadAudio).toHaveBeenCalledWith(
            'https://www.youtube.com/watch?v=test',
            expect.any(String),
            'vid',
            'm4a'
        );
        expect(wf.runWhisperToVtt).toHaveBeenCalled();
        expect(wf.loadSegmentsFromVttFile).toHaveBeenCalledWith('/fake/out.vtt');

        const body = await readFile(outFile, 'utf8');
        expect(body).toContain('source: whisper');
        expect(body).toContain('Whisper line');
    });

    it('skips subtitle download when forceWhisper is true', async () => {
        yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'manual-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, longVtt, 'utf8');
            return { kind: 'manual' as const, files: [p] };
        });
        yt.downloadAudio.mockResolvedValue('/fake/audio.m4a');
        wf.runWhisperToVtt.mockResolvedValue('/fake/out.vtt');
        wf.loadSegmentsFromVttFile.mockResolvedValue([{ startSec: 0, endSec: 1, text: 'forced' }]);

        const opts = { ...baseOptions(outFile), forceWhisper: true };
        const result = await runPipeline(opts);

        expect(yt.downloadManualSubs).not.toHaveBeenCalled();
        expect(yt.downloadAutoSubs).not.toHaveBeenCalled();
        expect(wf.assertWhisperCommandResolvable).toHaveBeenCalledWith(
            'whisper {{audio}} --output_dir {{outdir}}'
        );
        expect(result.meta.source).toBe('whisper');
    });

    it('writes plain text when format is txt', async () => {
        yt.downloadManualSubs.mockImplementation(async (_url: string, workDir: string) => {
            const subDir = path.join(workDir, 'manual-subs');
            await mkdir(subDir, { recursive: true });
            const p = path.join(subDir, 'vid.en.vtt');
            await writeFile(p, longVtt, 'utf8');
            return { kind: 'manual' as const, files: [p] };
        });
        yt.downloadAutoSubs.mockResolvedValue({ kind: 'auto', files: [] });

        const txtPath = path.join(outDir, 'out.txt');
        const result = await runPipeline({ ...baseOptions(txtPath), format: 'txt' });

        expect(result.writtenPath).toBe(txtPath);
        const body = await readFile(txtPath, 'utf8');
        expect(body).toBe(`${'x'.repeat(100)}\n`);
        expect(body).not.toContain('---');
    });
});
