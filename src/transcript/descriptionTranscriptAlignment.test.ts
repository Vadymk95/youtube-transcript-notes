import { describe, expect, it } from 'vitest';

import { DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS } from '@/transcript/descriptionAlignmentConfig';
import { assessVideoDescriptionAlignment } from '@/transcript/descriptionTranscriptAlignment';

describe('assessVideoDescriptionAlignment', () => {
    it('treats empty description as aligned', () => {
        expect(assessVideoDescriptionAlignment('', 'any transcript here')).toEqual({
            alignment: 'high',
            overlapRatio: 1,
            descriptionTokenCount: 0
        });
    });

    it('treats short descriptions as aligned without ratio test', () => {
        const r = assessVideoDescriptionAlignment('Hi there friend', 'elephant zoo habitat');
        expect(r.alignment).toBe('high');
        expect(r.descriptionTokenCount).toBeLessThan(10);
    });

    it('returns low when long promo text shares almost no tokens with transcript', () => {
        const pageDescription =
            'Microplastic pollution harms marine wildlife ecosystems worldwide scientists discovered shocking contamination levels in oceans urgent action required additional research studies demonstrate persistent organic pollutants bioaccumulation';
        const transcriptPlain =
            'The elephants at the zoo are amazing we love watching them eat hay and play with each other the zookeeper brings fresh water daily';
        const r = assessVideoDescriptionAlignment(pageDescription, transcriptPlain);
        expect(r.alignment).toBe('low');
        expect(r.descriptionTokenCount).toBeGreaterThanOrEqual(10);
        expect(r.overlapRatio).toBeLessThan(0.12);
    });

    it('returns high when description topics match transcript', () => {
        const pageDescription =
            'In this video we discuss elephants at the zoo daily care routines nutrition enrichment programs';
        const transcriptPlain =
            'Today we talk about elephants at the zoo daily care routines nutrition and enrichment programs for the animals';
        const r = assessVideoDescriptionAlignment(pageDescription, transcriptPlain);
        expect(r.alignment).toBe('high');
    });

    it('skips misalignment when min char threshold is above description length', () => {
        const pageDescription =
            'Microplastic pollution harms marine wildlife ecosystems worldwide scientists discovered shocking contamination';
        const transcriptPlain = 'The elephants at the zoo are amazing today';
        const r = assessVideoDescriptionAlignment(pageDescription, transcriptPlain, {
            ...DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS,
            minDescriptionCharsBeforeJudge: 10_000
        });
        expect(r.alignment).toBe('high');
    });

    it('treats URL-only description as aligned once letter tokens are below judge threshold', () => {
        const pageDescription = 'https://example.com/foo https://bar.com/baz';
        const transcriptPlain = 'completely different spoken words about other topics here';
        const r = assessVideoDescriptionAlignment(pageDescription, transcriptPlain);
        expect(r.alignment).toBe('high');
        expect(r.descriptionTokenCount).toBe(0);
    });
});
