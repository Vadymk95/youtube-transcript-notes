import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertYoutubeWatchUrl, isTranscriptAllowAnyUrlFromEnv } from '@/shared/youtubeUrlPolicy';

describe('assertYoutubeWatchUrl', () => {
    const prev = process.env.YT_TRANSCRIPT_ALLOW_ANY_URL;

    beforeEach(() => {
        delete process.env.YT_TRANSCRIPT_ALLOW_ANY_URL;
    });

    afterEach(() => {
        if (prev === undefined) {
            delete process.env.YT_TRANSCRIPT_ALLOW_ANY_URL;
        } else {
            process.env.YT_TRANSCRIPT_ALLOW_ANY_URL = prev;
        }
    });

    it('allows common YouTube hosts', () => {
        assertYoutubeWatchUrl('https://www.youtube.com/watch?v=abc');
        assertYoutubeWatchUrl('https://youtube.com/watch?v=abc');
        assertYoutubeWatchUrl('https://m.youtube.com/watch?v=abc');
        assertYoutubeWatchUrl('https://music.youtube.com/watch?v=abc');
        assertYoutubeWatchUrl('https://youtu.be/abc');
        assertYoutubeWatchUrl('http://www.youtube.com/watch?v=abc');
    });

    it('rejects non-http(s) and non-YouTube hosts', () => {
        expect(() => assertYoutubeWatchUrl('file:///etc/passwd')).toThrow('http');
        expect(() => assertYoutubeWatchUrl('https://evil.com/youtube.com')).toThrow();
        expect(() => assertYoutubeWatchUrl('')).toThrow('Malformed URL string');
    });

    it('skips allowlist when allowAnyUrl option is true', () => {
        assertYoutubeWatchUrl('https://example.com/v', { allowAnyUrl: true });
    });

    it('skips allowlist when YT_TRANSCRIPT_ALLOW_ANY_URL is set', () => {
        process.env.YT_TRANSCRIPT_ALLOW_ANY_URL = '1';
        assertYoutubeWatchUrl('https://example.com/v');
    });
});

describe('isTranscriptAllowAnyUrlFromEnv', () => {
    const prev = process.env.YT_TRANSCRIPT_ALLOW_ANY_URL;

    afterEach(() => {
        if (prev === undefined) {
            delete process.env.YT_TRANSCRIPT_ALLOW_ANY_URL;
        } else {
            process.env.YT_TRANSCRIPT_ALLOW_ANY_URL = prev;
        }
    });

    it('detects truthy env values', () => {
        delete process.env.YT_TRANSCRIPT_ALLOW_ANY_URL;
        expect(isTranscriptAllowAnyUrlFromEnv()).toBe(false);
        process.env.YT_TRANSCRIPT_ALLOW_ANY_URL = '1';
        expect(isTranscriptAllowAnyUrlFromEnv()).toBe(true);
        process.env.YT_TRANSCRIPT_ALLOW_ANY_URL = 'true';
        expect(isTranscriptAllowAnyUrlFromEnv()).toBe(true);
    });
});
