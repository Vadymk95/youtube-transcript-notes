import { readFile } from 'node:fs/promises';

import { parseWebVtt, segmentsCharCount } from './parseVtt.js';
import type { TranscriptSegment } from './types.js';

export type ScoredVtt = {
    path: string;
    segments: TranscriptSegment[];
    score: number;
};

export async function pickBestVtt(paths: string[]): Promise<ScoredVtt | null> {
    let best: ScoredVtt | null = null;
    for (const p of paths) {
        const raw = await readFile(p, 'utf8');
        const segments = parseWebVtt(raw);
        const score = segmentsCharCount(segments);
        if (!best || score > best.score) {
            best = { path: p, segments, score };
        }
    }
    return best;
}

/** Infer language code from yt-dlp filename: `{id}.{lang}.vtt` */
export function languageFromVttPath(filePath: string): string | undefined {
    const base = filePath.split(/[/\\]/).pop() ?? filePath;
    const withoutExt = base.replace(/\.vtt$/i, '');
    const parts = withoutExt.split('.');
    if (parts.length >= 2) {
        return parts[parts.length - 1];
    }
    return undefined;
}
