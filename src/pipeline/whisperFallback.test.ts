import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runCmdMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/runCmd', () => ({
    runCmd: runCmdMock
}));

import {
    assertWhisperCommandResolvable,
    extractWhisperExecutableForPreflight,
    loadSegmentsFromVttFile,
    runWhisperToVtt
} from '@/pipeline/whisperFallback';

const minimalVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
hello
`;

describe('extractWhisperExecutableForPreflight', () => {
    it('reads the first token from a default-style template', () => {
        expect(
            extractWhisperExecutableForPreflight(
                'whisper {{audio}} --output_dir {{outdir}} --model small'
            )
        ).toBe('whisper');
    });

    it('unwraps a quoted first token', () => {
        expect(extractWhisperExecutableForPreflight('"whisper-cli" {{audio}}')).toBe('whisper-cli');
    });

    it('returns null for pipes and shell delegation', () => {
        expect(extractWhisperExecutableForPreflight('sh -c "whisper foo"')).toBeNull();
        expect(extractWhisperExecutableForPreflight('cat x | whisper y')).toBeNull();
    });

    it('returns null when the command starts with a placeholder', () => {
        expect(extractWhisperExecutableForPreflight('{{whisper}} {{audio}}')).toBeNull();
    });
});

describe('assertWhisperCommandResolvable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves when command -v succeeds', async () => {
        runCmdMock.mockResolvedValue({ stdout: '/usr/bin/whisper\n', stderr: '' });
        await assertWhisperCommandResolvable('whisper {{audio}} --model tiny');
        expect(runCmdMock).toHaveBeenCalledWith('sh', ['-c', 'command -v -- "whisper"']);
    });

    it('throws when command -v fails', async () => {
        runCmdMock.mockRejectedValue(new Error('exit 1'));
        await expect(
            assertWhisperCommandResolvable('whisper {{audio}} --model tiny')
        ).rejects.toThrow(/was not found on PATH/);
    });

    it('resolves when the first token is an absolute path to an existing file', async () => {
        const marker = path.join(os.tmpdir(), `whisper-preflight-${Date.now()}.txt`);
        await writeFile(marker, '', 'utf8');
        try {
            await assertWhisperCommandResolvable(`${marker} {{audio}}`);
            expect(runCmdMock).not.toHaveBeenCalled();
        } finally {
            await rm(marker, { force: true });
        }
    });

    it('throws when the first token is an absolute path that does not exist', async () => {
        const missing = path.join(os.tmpdir(), `whisper-missing-${Date.now()}-no-such-file`);
        await expect(assertWhisperCommandResolvable(`${missing} {{audio}}`)).rejects.toThrow(
            /executable not found/
        );
        expect(runCmdMock).not.toHaveBeenCalled();
    });
});

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

        const template = 'touch {{audio}} && test -d {{outdir}}';
        await runWhisperToVtt(audio, whisperOut, template);

        expect(runCmdMock).toHaveBeenCalledTimes(1);
        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        expect(args[0]).toBe('-c');
        expect(args[1]).toContain(audio);
        expect(args[1]).toContain(whisperOut);
        expect(args[1]).not.toContain('{{audio}}');
        expect(args[1]).not.toContain('{{outdir}}');
    });

    it('POSIX-single-quotes audio and outdir paths that contain single quotes', async () => {
        const quotedDir = path.join(outDir, "with'quote");
        await mkdir(quotedDir, { recursive: true });
        const audio = path.join(quotedDir, 'track.m4a');
        await writeFile(audio, '', 'utf8');
        const whisperOut = path.join(quotedDir, 'whisper-out');
        await mkdir(whisperOut, { recursive: true });
        await writeFile(path.join(whisperOut, 'out.vtt'), minimalVtt, 'utf8');

        const template = 'test -f {{audio}} && test -d {{outdir}}';
        await runWhisperToVtt(audio, whisperOut, template);

        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        const shBody = args[1] as string;
        expect(shBody).toContain("with'\\''quote");
        expect(shBody).not.toBe(`test -f ${audio} && test -d ${whisperOut}`);
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

    it('omits full shell command from error unless YT_TRANSCRIPT_DEBUG is set', async () => {
        const prev = process.env.YT_TRANSCRIPT_DEBUG;
        delete process.env.YT_TRANSCRIPT_DEBUG;
        const audio = path.join(outDir, 'a.m4a');
        await writeFile(audio, '', 'utf8');
        const emptyWhisper = path.join(outDir, 'whisper-empty2');
        await mkdir(emptyWhisper, { recursive: true });

        try {
            await runWhisperToVtt(audio, emptyWhisper, 'true');
            expect.fail('expected throw');
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            expect(msg).not.toMatch(/Command was:/);
        }

        process.env.YT_TRANSCRIPT_DEBUG = '1';
        try {
            await runWhisperToVtt(audio, emptyWhisper, 'true');
            expect.fail('expected throw');
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            expect(msg).toMatch(/Command was:/);
        }

        if (prev === undefined) {
            delete process.env.YT_TRANSCRIPT_DEBUG;
        } else {
            process.env.YT_TRANSCRIPT_DEBUG = prev;
        }
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
