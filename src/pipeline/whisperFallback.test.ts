import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runCmdMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/runCmd', () => ({
    runCmd: runCmdMock
}));

import { loadSegmentsFromVttFile, runWhisperToVtt } from '@/pipeline/whisperFallback';

const minimalVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
hello
`;

describe('runWhisperToVtt', () => {
    let outDir: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        runCmdMock.mockResolvedValue({ stdout: '', stderr: '' });
        outDir = await mkdtemp(path.join(os.tmpdir(), 'whisper-fallback-test-'));
    });

    afterEach(async () => {
        await rm(outDir, { recursive: true, force: true });
    });

    it('interpolates placeholders into the shell command passed to sh -c', async () => {
        const audio = path.join(outDir, 'track.m4a');
        await writeFile(audio, '', 'utf8');
        const whisperOut = path.join(outDir, 'whisper-out');
        await mkdir(whisperOut, { recursive: true });
        await writeFile(path.join(whisperOut, 'out.vtt'), minimalVtt, 'utf8');

        const template = 'touch "{{audio}}" && test -d "{{outdir}}"';
        await runWhisperToVtt(audio, whisperOut, template);

        expect(runCmdMock).toHaveBeenCalledTimes(1);
        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        expect(args[0]).toBe('-c');
        expect(args[1]).toContain(audio);
        expect(args[1]).toContain(whisperOut);
        expect(args[1]).not.toContain('{{audio}}');
        expect(args[1]).not.toContain('{{outdir}}');
    });

    it('returns the newest .vtt when multiple exist', async () => {
        const audio = path.join(outDir, 'a.m4a');
        await writeFile(audio, '', 'utf8');
        const whisperOut = path.join(outDir, 'whisper-out');
        await mkdir(whisperOut, { recursive: true });

        const older = path.join(whisperOut, 'older.vtt');
        const newer = path.join(whisperOut, 'newer.vtt');
        await writeFile(older, minimalVtt, 'utf8');
        await writeFile(newer, minimalVtt, 'utf8');

        const oldTime = new Date('2020-01-01T00:00:00Z');
        const newTime = new Date('2024-06-01T00:00:00Z');
        await utimes(older, oldTime, oldTime);
        await utimes(newer, newTime, newTime);

        const picked = await runWhisperToVtt(audio, whisperOut, 'true');

        expect(picked).toBe(newer);
    });

    it('throws when Whisper produces no .vtt files', async () => {
        const audio = path.join(outDir, 'a.m4a');
        await writeFile(audio, '', 'utf8');
        const emptyWhisper = path.join(outDir, 'whisper-empty');
        await mkdir(emptyWhisper, { recursive: true });

        await expect(runWhisperToVtt(audio, emptyWhisper, 'true')).rejects.toThrow(
            /produced no \.vtt/
        );
    });
});

describe('loadSegmentsFromVttFile', () => {
    let file: string;

    beforeEach(async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), 'whisper-load-vtt-'));
        file = path.join(dir, 'sample.vtt');
        await writeFile(file, minimalVtt, 'utf8');
    });

    afterEach(async () => {
        await rm(path.dirname(file), { recursive: true, force: true });
    });

    it('reads a file and returns parsed segments', async () => {
        const segments = await loadSegmentsFromVttFile(file);
        expect(segments).toHaveLength(1);
        expect(segments[0]?.text).toBe('hello');
    });
});
