import path from 'node:path';

import { runCmd } from '@/shared/runCmd';
import type { TranscriptSegment } from '@/transcript/types';

export type KeyFrameExtractionOptions = {
    videoPath: string;
    outDir: string;
    /** Seconds at which to grab one still each. */
    timesSec: readonly number[];
};

/**
 * Picks segment start times for still extraction: greedy spacing by `minIntervalSec`, cap `maxFrames`.
 */
export function sampleKeyFrameTimes(
    segments: readonly TranscriptSegment[],
    maxFrames: number,
    minIntervalSec: number
): number[] {
    if (segments.length === 0 || maxFrames <= 0) {
        return [];
    }
    const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
    const out: number[] = [];
    let last = -Infinity;
    for (const s of sorted) {
        const t = Math.max(0, s.startSec);
        if (t - last >= minIntervalSec || out.length === 0) {
            out.push(t);
            last = t;
            if (out.length >= maxFrames) {
                break;
            }
        }
    }
    return out;
}

/**
 * Extracts one JPEG per timestamp via ffmpeg (seek before input for speed).
 */
export async function extractKeyFrameStills(options: KeyFrameExtractionOptions): Promise<string[]> {
    const { videoPath, outDir, timesSec } = options;
    const written: string[] = [];
    let index = 0;
    for (const sec of timesSec) {
        index += 1;
        const name = `frame-${String(index).padStart(3, '0')}.jpg`;
        const outPath = path.join(outDir, name);
        await runCmd('ffmpeg', [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-ss',
            String(sec),
            '-i',
            videoPath,
            '-frames:v',
            '1',
            '-q:v',
            '3',
            outPath
        ]);
        written.push(name);
    }
    return written;
}
