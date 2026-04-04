import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runCmdMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/runCmd', () => ({
    runCmd: runCmdMock
}));

import {
    DEFAULT_SUB_429_RETRY_MS,
    buildSequentialSubLangAttempts,
    downloadAutoSubs,
    downloadManualSubs,
    fetchVideoInfo,
    parseSub429RetryMs,
    parseVideoInfoFromDumpJson
} from '@/pipeline/ytDlp';

const minimalVtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
hello
`;

describe('parseSub429RetryMs', () => {
    it('uses default when unset or empty', () => {
        expect(parseSub429RetryMs(undefined)).toBe(DEFAULT_SUB_429_RETRY_MS);
        expect(parseSub429RetryMs('')).toBe(DEFAULT_SUB_429_RETRY_MS);
        expect(parseSub429RetryMs('   ')).toBe(DEFAULT_SUB_429_RETRY_MS);
    });

    it('parses non-negative integers and clamps negatives', () => {
        expect(parseSub429RetryMs('0')).toBe(0);
        expect(parseSub429RetryMs('100')).toBe(100);
        expect(parseSub429RetryMs(' 5000 ')).toBe(5000);
        expect(parseSub429RetryMs('-10')).toBe(0);
    });

    it('falls back to default when not a finite number', () => {
        expect(parseSub429RetryMs('abc')).toBe(DEFAULT_SUB_429_RETRY_MS);
        expect(parseSub429RetryMs('12px')).toBe(DEFAULT_SUB_429_RETRY_MS);
    });
});

describe('buildSequentialSubLangAttempts', () => {
    it('keeps all as a single heavy request', () => {
        expect(buildSequentialSubLangAttempts('all,-live_chat')).toEqual(['all,-live_chat']);
    });

    it('expands comma-separated positives with trailing exclusions', () => {
        expect(buildSequentialSubLangAttempts('en,ru,-live_chat')).toEqual([
            'en,-live_chat',
            'ru,-live_chat'
        ]);
    });

    it('omits exclusions when none listed', () => {
        expect(buildSequentialSubLangAttempts('de,fr')).toEqual(['de', 'fr']);
    });

    it('returns raw trim when no positive tokens', () => {
        expect(buildSequentialSubLangAttempts('-live_chat')).toEqual(['-live_chat']);
    });
});

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
    const prevRetry = process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS;

    beforeEach(async () => {
        vi.clearAllMocks();
        runCmdMock.mockResolvedValue({ stdout: '', stderr: '' });
        delete process.env.YT_TRANSCRIPT_SUB_LANGS;
        delete process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS;
        process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS = '0';
        workDir = await mkdtemp(path.join(os.tmpdir(), 'ytdlp-test-'));
    });

    afterEach(async () => {
        await rm(workDir, { recursive: true, force: true });
        if (prevSubLangs === undefined) {
            delete process.env.YT_TRANSCRIPT_SUB_LANGS;
        } else {
            process.env.YT_TRANSCRIPT_SUB_LANGS = prevSubLangs;
        }
        if (prevRetry === undefined) {
            delete process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS;
        } else {
            process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS = prevRetry;
        }
    });

    it('uses first sequential --sub-langs with exclusions and stops when vtt appears', async () => {
        const url = 'https://www.youtube.com/watch?v=test';
        runCmdMock.mockImplementation(async (_file: string, args: string[]) => {
            const idx = args.indexOf('--sub-langs');
            expect(args[idx + 1]).toBe('en,-live_chat');
            const oIdx = args.indexOf('-o');
            const outPattern = args[oIdx + 1] as string;
            const subDir = path.dirname(outPattern);
            await mkdir(subDir, { recursive: true });
            await writeFile(path.join(subDir, 'x.en.vtt'), minimalVtt, 'utf8');
            return { stdout: '', stderr: '' };
        });

        await downloadManualSubs(url, workDir);

        expect(runCmdMock).toHaveBeenCalledTimes(1);
    });

    it('tries the next language when yt-dlp succeeds but produces no vtt', async () => {
        const url = 'https://www.youtube.com/watch?v=test';
        let call = 0;
        runCmdMock.mockImplementation(async (_file: string, args: string[]) => {
            call++;
            const oIdx = args.indexOf('-o');
            const outPattern = args[oIdx + 1] as string;
            const subDir = path.dirname(outPattern);
            await mkdir(subDir, { recursive: true });
            const idx = args.indexOf('--sub-langs');
            if (call === 1) {
                expect(args[idx + 1]).toBe('en,-live_chat');
                return { stdout: '', stderr: '' };
            }
            expect(call).toBe(2);
            expect(args[idx + 1]).toBe('en-US,-live_chat');
            await writeFile(path.join(subDir, 'x.en-US.vtt'), minimalVtt, 'utf8');
            return { stdout: '', stderr: '' };
        });

        await downloadManualSubs(url, workDir);

        expect(runCmdMock).toHaveBeenCalledTimes(2);
    });

    it('uses trimmed YT_TRANSCRIPT_SUB_LANGS list for sequential attempts', async () => {
        process.env.YT_TRANSCRIPT_SUB_LANGS = '  de,fr  ';
        const url = 'https://www.youtube.com/watch?v=test';
        let call = 0;
        runCmdMock.mockImplementation(async (_file: string, args: string[]) => {
            call++;
            const idx = args.indexOf('--sub-langs');
            const oIdx = args.indexOf('-o');
            const outPattern = args[oIdx + 1] as string;
            const subDir = path.dirname(outPattern);
            await mkdir(subDir, { recursive: true });
            if (call === 1) {
                expect(args[idx + 1]).toBe('de');
                return { stdout: '', stderr: '' };
            }
            expect(args[idx + 1]).toBe('fr');
            await writeFile(path.join(subDir, 'x.fr.vtt'), minimalVtt, 'utf8');
            return { stdout: '', stderr: '' };
        });

        await downloadManualSubs(url, workDir);
        expect(runCmdMock).toHaveBeenCalledTimes(2);
    });

    it('falls back to default list when YT_TRANSCRIPT_SUB_LANGS is only whitespace', async () => {
        process.env.YT_TRANSCRIPT_SUB_LANGS = '   \t  ';
        runCmdMock.mockImplementation(async (_file: string, args: string[]) => {
            expect(args[args.indexOf('--sub-langs') + 1]).toBe('en,-live_chat');
            const oIdx = args.indexOf('-o');
            const outPattern = args[oIdx + 1] as string;
            const subDir = path.dirname(outPattern);
            await mkdir(subDir, { recursive: true });
            await writeFile(path.join(subDir, 'x.en.vtt'), minimalVtt, 'utf8');
            return { stdout: '', stderr: '' };
        });

        await downloadAutoSubs('https://www.youtube.com/watch?v=x', workDir);
        expect(runCmdMock).toHaveBeenCalledTimes(1);
    });

    it('retries once on HTTP 429 before trying the next language', async () => {
        process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS = '0';
        const url = 'https://www.youtube.com/watch?v=test';
        let call = 0;
        runCmdMock.mockImplementation(async (_file: string, args: string[]) => {
            call++;
            const oIdx = args.indexOf('-o');
            const outPattern = args[oIdx + 1] as string;
            const subDir = path.dirname(outPattern);
            await mkdir(subDir, { recursive: true });
            const idx = args.indexOf('--sub-langs');
            if (call === 1) {
                expect(args[idx + 1]).toBe('en,-live_chat');
                throw Object.assign(new Error('Command failed'), {
                    stderr: 'HTTP Error 429: Too Many Requests'
                });
            }
            if (call === 2) {
                expect(args[idx + 1]).toBe('en,-live_chat');
                await writeFile(path.join(subDir, 'x.en.vtt'), minimalVtt, 'utf8');
                return { stdout: '', stderr: '' };
            }
            expect.fail(`unexpected call ${call}`);
        });

        await downloadManualSubs(url, workDir);
        expect(runCmdMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a second 429 for the same language before moving on', async () => {
        process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS = '0';
        const url = 'https://www.youtube.com/watch?v=test';
        let call = 0;
        runCmdMock.mockImplementation(async (_file: string, args: string[]) => {
            call++;
            const oIdx = args.indexOf('-o');
            const outPattern = args[oIdx + 1] as string;
            const subDir = path.dirname(outPattern);
            await mkdir(subDir, { recursive: true });
            const idx = args.indexOf('--sub-langs');
            const subLang = args[idx + 1];
            if (call <= 2) {
                expect(subLang).toBe('en,-live_chat');
                throw Object.assign(new Error('Command failed'), {
                    stderr: 'HTTP Error 429: Too Many Requests'
                });
            }
            expect(call).toBe(3);
            expect(subLang).toBe('en-US,-live_chat');
            await writeFile(path.join(subDir, 'x.en-US.vtt'), minimalVtt, 'utf8');
            return { stdout: '', stderr: '' };
        });

        await downloadManualSubs(url, workDir);
        expect(runCmdMock).toHaveBeenCalledTimes(3);
    });
});
