import type { TranscriptMeta, TranscriptSegment } from '@/transcript/types';

function formatTimestamp(sec: number): string {
    const s = Math.max(0, sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = Math.floor(s % 60);
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(
            2,
            '0'
        )}`;
    }
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function toMarkdown(meta: TranscriptMeta, segments: TranscriptSegment[]): string {
    const headerLines = ['---', `source: ${meta.source}`];
    if (meta.videoId) {
        headerLines.push(`video_id: ${meta.videoId}`);
    }
    if (meta.title) {
        headerLines.push(`title: ${JSON.stringify(meta.title)}`);
    }
    if (meta.language) {
        headerLines.push(`language: ${meta.language}`);
    }
    if (meta.description !== undefined && meta.description !== '') {
        headerLines.push(`description: ${JSON.stringify(meta.description)}`);
    }
    headerLines.push('---', '');

    const body = segments
        .map((seg) => {
            const t = formatTimestamp(seg.startSec);
            return `**[${t}]** ${seg.text}`;
        })
        .join('\n\n');

    return `${headerLines.join('\n')}${body}\n`;
}

export function toPlainText(segments: TranscriptSegment[]): string {
    return segments.map((s) => s.text).join(' ');
}
