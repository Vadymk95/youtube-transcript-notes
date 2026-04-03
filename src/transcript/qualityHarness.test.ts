import { describe, expect, it } from 'vitest';

import {
    collectTranscriptQualityMetrics,
    runTranscriptQualityHarness
} from '@/transcript/qualityHarness';

describe('collectTranscriptQualityMetrics', () => {
    it('counts overlap, prefix, and segment sizes', () => {
        const metrics = collectTranscriptQualityMetrics([
            { startSec: 0, endSec: 1, text: 'alpha beta gamma' },
            { startSec: 1, endSec: 2, text: 'beta gamma delta epsilon' },
            { startSec: 2, endSec: 3, text: 'completely different' }
        ]);

        expect(metrics.segmentCount).toBe(3);
        expect(metrics.adjacentPrefixPairs).toBe(0);
        expect(metrics.adjacentOverlapPairs).toBe(0);
        expect(metrics.maxSegmentWords).toBe(4);
        expect(metrics.maxSegmentChars).toBe('beta gamma delta epsilon'.length);
    });
});

describe('runTranscriptQualityHarness', () => {
    it('passes the fixture corpus', async () => {
        const results = await runTranscriptQualityHarness();

        expect(results.length).toBeGreaterThan(0);
        expect(results.every((result) => result.passed)).toBe(true);
    });

    it('can run a single named fixture', async () => {
        const [result] = await runTranscriptQualityHarness({ fixtureId: 'youtube-qku-opening' });

        expect(result?.fixture.id).toBe('youtube-qku-opening');
        expect(result?.passed).toBe(true);
        expect(result?.cleaned.segmentCount).toBeLessThan(result?.baseline.segmentCount ?? 0);
    });

    it('can filter the corpus by tag', async () => {
        const results = await runTranscriptQualityHarness({ tag: 'real-world' });

        expect(results).toHaveLength(1);
        expect(results[0]?.fixture.id).toBe('youtube-qku-opening');
    });
});
