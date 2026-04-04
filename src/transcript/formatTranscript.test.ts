import { describe, expect, it } from 'vitest';

import { toMarkdown, toPlainText } from '@/transcript/formatTranscript';
import type { TranscriptMeta, TranscriptSegment } from '@/transcript/types';

const sampleSegs: TranscriptSegment[] = [
    { startSec: 0, endSec: 5, text: 'Intro' },
    { startSec: 65, endSec: 70, text: 'Middle' },
    { startSec: 3661, endSec: 3665, text: 'Late' }
];

describe('toMarkdown', () => {
    it('writes front matter and timestamped segments', () => {
        const meta: TranscriptMeta = {
            source: 'subtitle-auto',
            videoId: 'abc123',
            title: 'Test "Video"',
            language: 'en'
        };
        const md = toMarkdown(meta, sampleSegs);
        expect(md).toContain('source: subtitle-auto');
        expect(md).toContain('video_id: abc123');
        expect(md).toContain('language: en');
        expect(md).toContain(`title: ${JSON.stringify('Test "Video"')}`);
        expect(md).toContain('**[00:00]** Intro');
        expect(md).toContain('**[01:05]** Middle');
        expect(md).toContain('**[01:01:01]** Late');
        expect(md.endsWith('\n')).toBe(true);
    });

    it('omits optional meta lines when absent', () => {
        const meta: TranscriptMeta = { source: 'whisper' };
        const md = toMarkdown(meta, [{ startSec: 3, endSec: 4, text: 'x' }]);
        expect(md).toContain('source: whisper');
        expect(md).not.toContain('video_id:');
        expect(md).not.toContain('title:');
        expect(md).not.toContain('language:');
        expect(md).not.toContain('description:');
    });

    it('includes description in front matter when set', () => {
        const meta: TranscriptMeta = {
            source: 'subtitle-auto',
            videoId: 'x',
            title: 'T',
            description: 'Links: https://a.test\nSecond line'
        };
        const md = toMarkdown(meta, [{ startSec: 0, endSec: 1, text: 'hi' }]);
        expect(md).toContain(
            `description: ${JSON.stringify('Links: https://a.test\nSecond line')}`
        );
    });
});

describe('toPlainText', () => {
    it('joins segment texts with spaces', () => {
        expect(toPlainText(sampleSegs)).toBe('Intro Middle Late');
    });
});
