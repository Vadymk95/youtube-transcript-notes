import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runCmdMock = vi.hoisted(() => vi.fn());

vi.mock('../shared/runCmd.js', () => ({
    runCmd: runCmdMock
}));

import { downloadAutoSubs, downloadManualSubs } from './ytDlp.js';

const defaultSubLangs = 'en,en-US,en-orig,ru,uk,-live_chat';

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
