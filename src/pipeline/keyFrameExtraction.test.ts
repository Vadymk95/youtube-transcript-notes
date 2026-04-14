import { describe, expect, it } from 'vitest';

import { sampleKeyFrameTimes } from '@/pipeline/keyFrameExtraction';
import type { TranscriptSegment } from '@/transcript/types';

describe('sampleKeyFrameTimes', () => {
    it('returns empty when no segments', () => {
        expect(sampleKeyFrameTimes([], 10, 30)).toEqual([]);
    });

    it('respects maxFrames and minimum spacing', () => {
        const segments: TranscriptSegment[] = [
            { startSec: 0, endSec: 1, text: 'a' },
            { startSec: 5, endSec: 6, text: 'b' },
            { startSec: 10, endSec: 11, text: 'c' },
            { startSec: 100, endSec: 101, text: 'd' }
        ];
        const times = sampleKeyFrameTimes(segments, 2, 45);
        expect(times.length).toBeLessThanOrEqual(2);
        expect(times[0]).toBe(0);
        if (times.length >= 2) {
            expect(times[1] - times[0]).toBeGreaterThanOrEqual(45);
        }
    });

    it('always includes first segment start when within maxFrames', () => {
        const segments: TranscriptSegment[] = [{ startSec: 12, endSec: 13, text: 'x' }];
        expect(sampleKeyFrameTimes(segments, 5, 30)).toEqual([12]);
    });
});
