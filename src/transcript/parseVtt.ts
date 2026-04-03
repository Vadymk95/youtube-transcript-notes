import type { TranscriptSegment } from '@/transcript/types';

const TIME_LINE = /^(\d{1,2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(\d{1,2}:)?\d{2}:\d{2}\.\d{3}/;

function parseTimestamp(part: string): number {
    const trimmed = part.trim();
    const segments = trimmed.split(':');
    if (segments.length === 3) {
        const h = Number(segments[0]);
        const m = Number(segments[1]);
        const s = Number(segments[2]);
        if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s)) {
            return h * 3600 + m * 60 + s;
        }
    }
    if (segments.length === 2) {
        const m = Number(segments[0]);
        const s = Number(segments[1]);
        if (Number.isFinite(m) && Number.isFinite(s)) {
            return m * 60 + s;
        }
    }
    return 0;
}

function parseCueTimes(line: string): { start: number; end: number } | null {
    const match = line.match(TIME_LINE);
    if (!match || match.index === undefined) {
        return null;
    }
    const arrow = line.indexOf('-->');
    if (arrow < 0) {
        return null;
    }
    const startRaw = line.slice(0, arrow).trim();
    const endRaw = line
        .slice(arrow + 3)
        .trim()
        .split(/\s+/)[0];
    if (!endRaw) {
        return null;
    }
    return { start: parseTimestamp(startRaw), end: parseTimestamp(endRaw) };
}

/** Strip WebVTT cue identifiers, voice tags, and basic HTML. */
function cleanCueText(raw: string): string {
    return raw
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

export function parseWebVtt(content: string): TranscriptSegment[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const segments: TranscriptSegment[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i] ?? '';
        if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.trim() === '') {
            i += 1;
            continue;
        }

        const times = parseCueTimes(line);
        if (!times) {
            i += 1;
            continue;
        }

        i += 1;
        const textLines: string[] = [];
        while (i < lines.length) {
            const l = lines[i] ?? '';
            if (l.trim() === '') {
                break;
            }
            if (TIME_LINE.test(l)) {
                break;
            }
            textLines.push(l);
            i += 1;
        }

        const text = cleanCueText(textLines.join(' '));
        if (text.length > 0) {
            segments.push({
                startSec: times.start,
                endSec: times.end,
                text
            });
        }
    }

    return segments;
}

export function segmentsCharCount(segments: TranscriptSegment[]): number {
    return segments.reduce((acc, s) => acc + s.text.length, 0);
}
