import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runCmdMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/runCmd', () => ({
    runCmd: runCmdMock
}));

import {
    downloadAutoSubs,
    downloadManualSubs,
    fetchVideoInfo,
    parseVideoInfoFromDumpJson
} from '@/pipeline/ytDlp';

const defaultSubLangs = 'en,en-US,en-orig,ru,uk,-live_chat';

describe('parseVideoInfoFromDumpJson', () => {
    it('reads id, title, and description', () => {
        const info = parseVideoInfoFromDumpJson(
            JSON.stringify({
                id: 'abc',
                title: 'Hello',
                description: 'More info\nhttps://x.test'
            })
        );
        expect(info).toEqual({
            id: 'abc',
            title: 'Hello',
            description: 'More info\nhttps://x.test'
        });
    });

    it('uses id as title when title missing', () => {
        const info = parseVideoInfoFromDumpJson(JSON.stringify({ id: 'only' }));
        expect(info.title).toBe('only');
        expect(info.description).toBe('');
    });

    it('normalizes empty description to empty string', () => {
        const info = parseVideoInfoFromDumpJson(
            JSON.stringify({ id: 'a', title: 'T', description: '   ' })
        );
        expect(info.description).toBe('');
    });

    it('throws on invalid JSON with SyntaxError chained as cause', () => {
        try {
            parseVideoInfoFromDumpJson('not json');
            expect.fail('expected throw');
        } catch (e) {
            expect(e).toBeInstanceOf(Error);
            const err = e as Error;
            expect(err.message).toContain('yt-dlp did not return valid JSON');
            expect(err.cause).toBeInstanceOf(SyntaxError);
        }
    });

    it('throws when id missing', () => {
        expect(() => parseVideoInfoFromDumpJson(JSON.stringify({ title: 'x' }))).toThrow(
            'yt-dlp did not return video id'
        );
    });

    it('throws when JSON root is null', () => {
        expect(() => parseVideoInfoFromDumpJson('null')).toThrow(
            'yt-dlp JSON metadata was not an object'
        );
    });

    it('throws when id is empty string', () => {
        expect(() => parseVideoInfoFromDumpJson(JSON.stringify({ id: '' }))).toThrow(
            'yt-dlp did not return video id'
        );
    });

    it('uses id as title when title is only whitespace', () => {
        const info = parseVideoInfoFromDumpJson(
            JSON.stringify({ id: 'vid9', title: '   \t  ', description: 'd' })
        );
        expect(info.title).toBe('vid9');
        expect(info.description).toBe('d');
    });
});

describe('fetchVideoInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls yt-dlp with dump-single-json and parses stdout', async () => {
        const url = 'https://www.youtube.com/watch?v=abc';
        runCmdMock.mockResolvedValue({
            stdout: JSON.stringify({ id: 'abc', title: 'Hello', description: 'More' }),
            stderr: ''
        });

        const info = await fetchVideoInfo(url);

        expect(runCmdMock).toHaveBeenCalledTimes(1);
        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        expect(args).toEqual(['--skip-download', '--no-warnings', '--dump-single-json', url]);
        expect(info).toEqual({ id: 'abc', title: 'Hello', description: 'More' });
    });
});

describe('ytDlp subtitle downloads', () => {
    let workDir: string;
    const prevSubLangs = process.env.YT_TRANSCRIPT_SUB_LANGS;

    beforeEach(async () => {
        vi.clearAllMocks();
        runCmdMock.mockResolvedValue({ stdout: '', stderr: '' });
        delete process.env.YT_TRANSCRIPT_SUB_LANGS;
        workDir = await mkdtemp(path.join(os.tmpdir(), 'ytdlp-test-'));
    });

    afterEach(async () => {
        await rm(workDir, { recursive: true, force: true });
        if (prevSubLangs === undefined) {
            delete process.env.YT_TRANSCRIPT_SUB_LANGS;
        } else {
            process.env.YT_TRANSCRIPT_SUB_LANGS = prevSubLangs;
        }
    });

    it('passes default --sub-langs for manual subtitle fetch', async () => {
        const url = 'https://www.youtube.com/watch?v=test';
        await downloadManualSubs(url, workDir);

        expect(runCmdMock).toHaveBeenCalledTimes(1);
        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        const idx = args.indexOf('--sub-langs');
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(args[idx + 1]).toBe(defaultSubLangs);
    });

    it('passes default --sub-langs for auto subtitle fetch', async () => {
        const url = 'https://www.youtube.com/watch?v=test';
        await downloadAutoSubs(url, workDir);

        expect(runCmdMock).toHaveBeenCalledTimes(1);
        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        const idx = args.indexOf('--sub-langs');
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(args[idx + 1]).toBe(defaultSubLangs);
    });

    it('uses trimmed YT_TRANSCRIPT_SUB_LANGS when set', async () => {
        process.env.YT_TRANSCRIPT_SUB_LANGS = '  de,fr  ';
        const url = 'https://www.youtube.com/watch?v=test';
        await downloadManualSubs(url, workDir);

        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        const idx = args.indexOf('--sub-langs');
        expect(args[idx + 1]).toBe('de,fr');
    });

    it('falls back to default when YT_TRANSCRIPT_SUB_LANGS is only whitespace', async () => {
        process.env.YT_TRANSCRIPT_SUB_LANGS = '   \t  ';
        await downloadAutoSubs('https://www.youtube.com/watch?v=x', workDir);

        const [, args] = runCmdMock.mock.calls[0] as [string, string[]];
        const idx = args.indexOf('--sub-langs');
        expect(args[idx + 1]).toBe(defaultSubLangs);
    });
});
