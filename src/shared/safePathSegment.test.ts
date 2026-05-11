import { afterEach, describe, expect, it } from 'vitest';

import {
    assertSafeVideoIdForPath,
    buildArtifactDirName,
    INVALID_VIDEO_ID_PREFIX,
    slugifyForPath
} from '@/shared/safePathSegment';

describe('assertSafeVideoIdForPath', () => {
    it('accepts typical YouTube id and numeric-style id', () => {
        assertSafeVideoIdForPath('dQw4w9WgXcQ');
        assertSafeVideoIdForPath('1234567890123');
    });

    it('accepts trim-only normalization is caller responsibility; trimmed id must be safe', () => {
        assertSafeVideoIdForPath('abc');
    });

    it('rejects empty and whitespace-only', () => {
        expect(() => assertSafeVideoIdForPath('')).toThrow(INVALID_VIDEO_ID_PREFIX);
        expect(() => assertSafeVideoIdForPath('   ')).toThrow(INVALID_VIDEO_ID_PREFIX);
    });

    it('rejects traversal and separators', () => {
        expect(() => assertSafeVideoIdForPath('../x')).toThrow(INVALID_VIDEO_ID_PREFIX);
        expect(() => assertSafeVideoIdForPath('x/y')).toThrow(INVALID_VIDEO_ID_PREFIX);
        expect(() => assertSafeVideoIdForPath('..')).toThrow(INVALID_VIDEO_ID_PREFIX);
        expect(() => assertSafeVideoIdForPath('a..b')).toThrow(INVALID_VIDEO_ID_PREFIX);
    });

    it('rejects newline and null', () => {
        expect(() => assertSafeVideoIdForPath('a\nb')).toThrow(INVALID_VIDEO_ID_PREFIX);
        expect(() => assertSafeVideoIdForPath('a\0b')).toThrow(INVALID_VIDEO_ID_PREFIX);
    });

    it('rejects leading hyphen', () => {
        expect(() => assertSafeVideoIdForPath('-foo')).toThrow(INVALID_VIDEO_ID_PREFIX);
    });

    it('rejects length over 200', () => {
        expect(() => assertSafeVideoIdForPath('a'.repeat(201))).toThrow(INVALID_VIDEO_ID_PREFIX);
    });

    const originalPlatform = process.platform;

    afterEach(() => {
        Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform });
    });

    it('rejects Windows-forbidden characters when platform is win32', () => {
        Object.defineProperty(process, 'platform', { configurable: true, value: 'win32' });
        expect(() => assertSafeVideoIdForPath('a:b')).toThrow(INVALID_VIDEO_ID_PREFIX);
        expect(() => assertSafeVideoIdForPath('a|b')).toThrow(INVALID_VIDEO_ID_PREFIX);
    });

    it('allows colon in id on non-win32 platforms', () => {
        Object.defineProperty(process, 'platform', { configurable: true, value: 'darwin' });
        assertSafeVideoIdForPath('a:b');
    });
});

describe('slugifyForPath', () => {
    it('lowercases ASCII and joins words with dashes', () => {
        expect(slugifyForPath('Faster Docker on macOS')).toBe('faster-docker-on-macos');
    });

    it('strips punctuation and collapses repeats', () => {
        expect(slugifyForPath('Codex Just Became THE BEST!!! Long-Running Agentic Harness')).toBe(
            'codex-just-became-the-best-long-running-agentic'
        );
    });

    it('strips diacritics', () => {
        expect(slugifyForPath('Café au lait — résumé')).toBe('cafe-au-lait-resume');
    });

    it('transliterates basic Cyrillic to ASCII', () => {
        expect(slugifyForPath('Этот AI-агент за 10 минут')).toBe('etot-ai-agent-za-10-minut');
    });

    it('returns empty string for emoji-only or non-alphanumeric input', () => {
        expect(slugifyForPath('🚀🚀🚀')).toBe('');
        expect(slugifyForPath('!!! ??? ...')).toBe('');
    });

    it('returns empty string for non-string input', () => {
        // @ts-expect-error testing runtime tolerance for invalid input
        expect(slugifyForPath(null)).toBe('');
        // @ts-expect-error testing runtime tolerance for invalid input
        expect(slugifyForPath(undefined)).toBe('');
    });

    it('trims at the last word boundary within maxLen', () => {
        const slug = slugifyForPath(
            'this is a very long title that should be trimmed at a word boundary near the limit',
            50
        );
        expect(slug.length).toBeLessThanOrEqual(50);
        expect(slug.endsWith('-')).toBe(false);
        expect(slug).toBe('this-is-a-very-long-title-that-should-be-trimmed');
    });

    it('respects custom maxLen', () => {
        expect(slugifyForPath('alpha beta gamma delta', 10)).toBe('alpha-beta');
    });

    it('returns the full slug when shorter than maxLen', () => {
        expect(slugifyForPath('short', 50)).toBe('short');
    });
});

describe('buildArtifactDirName', () => {
    it('joins slug and short id', () => {
        expect(buildArtifactDirName('Faster Docker on macOS', 'aJe7CvQ-aM8')).toBe(
            'faster-docker-on-macos-aJe7Cv'
        );
    });

    it('falls back to raw video id when the title yields an empty slug', () => {
        expect(buildArtifactDirName('🚀🚀🚀', 'abc12345678')).toBe('abc12345678');
    });

    it('handles Cyrillic titles via transliteration', () => {
        const name = buildArtifactDirName(
            'Этот AI-агент набрал 130 000 звёзд за 10 недель',
            'Kiw_HSR3YkQ'
        );
        expect(name.startsWith('etot-ai-agent-')).toBe(true);
        expect(name.endsWith('-Kiw_HS')).toBe(true);
    });

    it('respects custom maxSlugLen and shortIdLen', () => {
        expect(
            buildArtifactDirName('alpha beta gamma delta', 'longid', {
                maxSlugLen: 10,
                shortIdLen: 3
            })
        ).toBe('alpha-beta-lon');
    });

    it('validates final segment via assertSafeVideoIdForPath', () => {
        // empty title + empty id → empty name → assert throws
        expect(() => buildArtifactDirName('', '')).toThrow(INVALID_VIDEO_ID_PREFIX);
        // empty title + id starting with '-' → fallback to raw id, leading '-' rejected
        expect(() => buildArtifactDirName('', '-bad')).toThrow(INVALID_VIDEO_ID_PREFIX);
    });

    it('keeps the slug length below maxSlugLen + 1 + shortIdLen', () => {
        const name = buildArtifactDirName(
            'an exceptionally long video title that goes well past the default fifty character cap and keeps going',
            'aBcDeFgHiJk'
        );
        // 50 slug + '-' + 6 id = 57 chars max
        expect(name.length).toBeLessThanOrEqual(57);
        expect(name.endsWith('-aBcDeF')).toBe(true);
    });
});
