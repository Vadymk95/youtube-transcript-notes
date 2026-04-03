import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { languageFromVttPath, pickBestVtt } from '@/transcript/pickBestVtt';

describe('languageFromVttPath', () => {
    it('returns last dot segment before .vtt', () => {
        expect(languageFromVttPath('/tmp/xyz.en.vtt')).toBe('en');
        expect(languageFromVttPath('C:\\foo\\id.uk.vtt')).toBe('uk');
    });

    it('returns undefined for single-part basename', () => {
        expect(languageFromVttPath('captions.vtt')).toBeUndefined();
    });
});

describe('pickBestVtt', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(os.tmpdir(), 'pick-best-vtt-'));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it('returns null for empty paths', async () => {
        await expect(pickBestVtt([])).resolves.toBeNull();
    });

    it('picks the file with more transcript characters', async () => {
        const shortVtt = `WEBVTT
00:00:00.000 --> 00:00:01.000
Hi
`;
        const longVtt = `WEBVTT
00:00:00.000 --> 00:00:01.000
This is a much longer cue text for scoring
`;
        const a = path.join(dir, 'a.en.vtt');
        const b = path.join(dir, 'b.ru.vtt');
        await writeFile(a, shortVtt, 'utf8');
        await writeFile(b, longVtt, 'utf8');

        const best = await pickBestVtt([a, b]);
        expect(best).not.toBeNull();
        expect(best?.path).toBe(b);
        expect(best?.score).toBeGreaterThan(10);
    });
});
