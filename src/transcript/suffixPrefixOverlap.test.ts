import { describe, expect, it } from 'vitest';

import {
    findSuffixPrefixOverlap,
    MAX_OVERLAP_WINDOW_WORDS,
    MIN_OVERLAP_WORDS,
    norm,
    normalizeWord,
    tokenize
} from '@/transcript/suffixPrefixOverlap';

describe('norm', () => {
    it('collapses whitespace and trims', () => {
        expect(norm('  a \t  b \n c  ')).toBe('a b c');
    });
});

describe('normalizeWord', () => {
    it('strips leading and trailing punctuation for letters', () => {
        expect(normalizeWord('Hello,')).toBe('hello');
        expect(normalizeWord('"Beta"')).toBe('beta');
    });
});

describe('tokenize', () => {
    it('returns raw and normalized tokens', () => {
        const { raw, normalized } = tokenize('Alpha  beta');
        expect(raw).toEqual(['Alpha', 'beta']);
        expect(normalized).toEqual(['alpha', 'beta']);
    });
});

describe('findSuffixPrefixOverlap', () => {
    it('returns no overlap when there is no shared suffix/prefix', () => {
        expect(findSuffixPrefixOverlap('one two three', 'four five six')).toEqual({
            wordCount: 0,
            charCount: 0,
            ratio: 0
        });
    });

    it('ignores overlaps shorter than MIN_OVERLAP_WORDS for rolling-caption style pairs', () => {
        const short = findSuffixPrefixOverlap('alpha beta gamma', 'beta gamma delta epsilon');
        expect(short.wordCount).toBe(2);
        expect(short.wordCount).toBeLessThan(MIN_OVERLAP_WORDS);
    });

    it('detects a four-word sliding-window repetition used by the collapser', () => {
        const overlap = findSuffixPrefixOverlap(
            'alpha beta gamma delta epsilon zeta',
            'gamma delta epsilon zeta eta theta iota'
        );
        expect(overlap.wordCount).toBe(4);
        expect(overlap.charCount).toBe('gamma delta epsilon zeta'.length);
        expect(overlap.ratio).toBeCloseTo(4 / 6);
    });

    it('caps the search window at MAX_OVERLAP_WINDOW_WORDS', () => {
        const wordsA = Array.from({ length: 25 }, (_, i) => `w${i}`).join(' ');
        const wordsB = Array.from({ length: 25 }, (_, i) => `w${i + 7}`).join(' ');
        const overlap = findSuffixPrefixOverlap(wordsA, wordsB);
        expect(overlap.wordCount).toBe(MAX_OVERLAP_WINDOW_WORDS);
    });

    it('matches case-insensitively via normalized tokens', () => {
        const overlap = findSuffixPrefixOverlap(
            'Prefix ONE two THREE four',
            'one Two THREE four five six seven eight'
        );
        expect(overlap.wordCount).toBe(4);
    });
});
