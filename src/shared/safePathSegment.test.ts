import { afterEach, describe, expect, it } from 'vitest';

import { assertSafeVideoIdForPath, INVALID_VIDEO_ID_PREFIX } from '@/shared/safePathSegment';

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
