import { describe, expect, it } from 'vitest';

import { parseWebVtt, segmentsCharCount } from './parseVtt.js';

describe('parseWebVtt', () => {
    it('parses simple cues with WEBVTT header', () => {
        const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
First line

00:00:05.000 --> 00:00:08.000
Second line
`;
        const segs = parseWebVtt(vtt);
        expect(segs).toHaveLength(2);
        expect(segs[0]).toEqual({
            startSec: 1,
            endSec: 4,
            text: 'First line'
        });
        expect(segs[1]).toEqual({
            startSec: 5,
            endSec: 8,
            text: 'Second line'
        });
    });

    it('parses hour-based timestamps and fractional seconds', () => {
        const vtt = `WEBVTT

01:02:03.000 --> 01:02:06.500
After one hour
`;
        const segs = parseWebVtt(vtt);
        expect(segs).toHaveLength(1);
        expect(segs[0]?.startSec).toBe(3600 + 120 + 3);
        expect(segs[0]?.endSec).toBe(3600 + 120 + 6.5);
    });

    it('strips basic HTML and entities in cue text', () => {
        const vtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
Hello <b>world</b> &amp; friends
`;
        const segs = parseWebVtt(vtt);
        expect(segs[0]?.text).toBe('Hello world & friends');
    });

    it('skips NOTE blocks and blank lines', () => {
        const vtt = `WEBVTT

NOTE comment
00:00:01.000 --> 00:00:02.000
Only cue
`;
        const segs = parseWebVtt(vtt);
        expect(segs).toHaveLength(1);
        expect(segs[0]?.text).toBe('Only cue');
    });

    it('handles CRLF line endings', () => {
        const vtt = 'WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nOne\r\n';
        const segs = parseWebVtt(vtt);
        expect(segs[0]?.text).toBe('One');
    });

    it('ignores standalone cue index lines before timing line', () => {
        const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:02.000
Indexed cue
`;
        const segs = parseWebVtt(vtt);
        expect(segs).toHaveLength(1);
        expect(segs[0]?.text).toBe('Indexed cue');
    });

    it('joins multiline cue text with a single space', () => {
        const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
First line of cue
Second line continues here
`;
        const segs = parseWebVtt(vtt);
        expect(segs).toHaveLength(1);
        expect(segs[0]?.text).toBe('First line of cue Second line continues here');
        expect(segs[0]?.startSec).toBe(1);
        expect(segs[0]?.endSec).toBe(4);
    });
});

describe('segmentsCharCount', () => {
    it('sums text lengths', () => {
        expect(
            segmentsCharCount([
                { startSec: 0, endSec: 1, text: 'ab' },
                { startSec: 1, endSec: 2, text: 'cde' }
            ])
        ).toBe(5);
    });
});
