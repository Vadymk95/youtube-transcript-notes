import { describe, expect, it } from 'vitest';

import { collapseRollingAutoCaptions } from './collapseRollingCaptions.js';

describe('collapseRollingAutoCaptions', () => {
    it('merges a YouTube-style rolling prefix chain into one segment', () => {
        const segs = collapseRollingAutoCaptions([
            { startSec: 0, endSec: 1, text: 'I love' },
            { startSec: 0.5, endSec: 2, text: 'I love cats' },
            { startSec: 1, endSec: 3, text: 'I love cats today' }
        ]);
        expect(segs).toEqual([{ startSec: 0, endSec: 3, text: 'I love cats today' }]);
    });

    it('keeps unrelated consecutive cues separate', () => {
        const segs = collapseRollingAutoCaptions([
            { startSec: 0, endSec: 1, text: 'First sentence.' },
            { startSec: 2, endSec: 3, text: 'Second sentence.' }
        ]);
        expect(segs).toHaveLength(2);
    });

    it('normalizes whitespace for prefix detection', () => {
        const segs = collapseRollingAutoCaptions([
            { startSec: 0, endSec: 1, text: 'Hello  world' },
            { startSec: 1, endSec: 2, text: 'Hello world today' }
        ]);
        expect(segs).toEqual([{ startSec: 0, endSec: 2, text: 'Hello world today' }]);
    });

    it('does not merge when the next cue is not an extension', () => {
        const segs = collapseRollingAutoCaptions([
            { startSec: 0, endSec: 1, text: 'Hello' },
            { startSec: 1, endSec: 2, text: 'Goodbye' }
        ]);
        expect(segs).toHaveLength(2);
    });

    it('trims sliding-window overlap and rebuilds a readable phrase', () => {
        const segs = collapseRollingAutoCaptions([
            {
                startSec: 0,
                endSec: 2,
                text: 'alpha beta gamma delta epsilon zeta'
            },
            {
                startSec: 1.5,
                endSec: 3,
                text: 'gamma delta epsilon zeta eta theta iota'
            },
            {
                startSec: 2.5,
                endSec: 4,
                text: 'epsilon zeta eta theta iota kappa lambda'
            }
        ]);
        expect(segs).toEqual([
            {
                startSec: 0,
                endSec: 4,
                text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda'
            }
        ]);
    });

    it('drops duplicate suffix cues that add no new text', () => {
        const segs = collapseRollingAutoCaptions([
            {
                startSec: 0,
                endSec: 2,
                text: 'we should probably test the fallback too'
            },
            {
                startSec: 1.5,
                endSec: 3,
                text: 'test the fallback too'
            }
        ]);
        expect(segs).toEqual([
            {
                startSec: 0,
                endSec: 3,
                text: 'we should probably test the fallback too'
            }
        ]);
    });

    it('does not merge different cues that share only a short common phrase', () => {
        const segs = collapseRollingAutoCaptions([
            {
                startSec: 0,
                endSec: 2,
                text: 'I think this feature is pretty useful overall'
            },
            {
                startSec: 1.8,
                endSec: 4,
                text: 'I think we should probably test the fallback too'
            }
        ]);
        expect(segs).toHaveLength(2);
    });

    it('keeps the next cue intact when overlap crosses a sentence boundary only weakly', () => {
        const segs = collapseRollingAutoCaptions([
            {
                startSec: 0,
                endSec: 2,
                text: 'This is a complete sentence.'
            },
            {
                startSec: 1.8,
                endSec: 4,
                text: 'This is a complete sentence about our roadmap today'
            }
        ]);
        expect(segs).toEqual([
            {
                startSec: 0,
                endSec: 2,
                text: 'This is a complete sentence.'
            },
            {
                startSec: 1.8,
                endSec: 4,
                text: 'This is a complete sentence about our roadmap today'
            }
        ]);
    });
});
