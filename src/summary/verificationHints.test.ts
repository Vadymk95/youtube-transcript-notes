import { describe, expect, it } from 'vitest';

import { buildVerificationHintsMarkdown, extractHttpUrls } from '@/summary/verificationHints';

describe('extractHttpUrls', () => {
    it('dedupes and strips trailing punctuation', () => {
        const text = 'See https://a.test/x), also https://b.test/y.';
        expect(extractHttpUrls(text)).toEqual(['https://a.test/x', 'https://b.test/y']);
    });
});

describe('buildVerificationHintsMarkdown', () => {
    it('includes anchors and video URL', () => {
        const md = buildVerificationHintsMarkdown({
            videoUrl: 'https://www.youtube.com/watch?v=z',
            pageDescription: '',
            segments: [
                { startSec: 0, endSec: 1, text: 'Hello' },
                { startSec: 60, endSec: 61, text: 'World' }
            ],
            maxAnchors: 5
        });
        expect(md).toContain('https://www.youtube.com/watch?v=z');
        expect(md).toContain('0:00');
        expect(md).toContain('1:00');
        expect(md).toContain('Hello');
        expect(md).toContain('World');
    });
});
