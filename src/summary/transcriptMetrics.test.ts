import { describe, expect, it } from 'vitest';

import { computeTranscriptCharMetrics } from '@/summary/transcriptMetrics';

describe('computeTranscriptCharMetrics', () => {
    it('returns full length when there is no front matter', () => {
        const s = 'plain text';
        expect(computeTranscriptCharMetrics(s)).toEqual({
            fileChars: s.length,
            bodyChars: s.length
        });
    });

    it('splits body after closing --- (no blank line before body)', () => {
        const fm = '---\nsource: x\n---\n';
        const body = '**[00:00]** hi';
        const full = `${fm}${body}`;
        expect(computeTranscriptCharMetrics(full)).toEqual({
            fileChars: full.length,
            bodyChars: body.length
        });
    });

    it('allows blank line after closing ---', () => {
        const full = '---\na: 1\n---\n\n**[00:00]** x\n';
        expect(computeTranscriptCharMetrics(full).bodyChars).toBe('**[00:00]** x\n'.length);
    });
});
