import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { extractKeyFrameStills, sampleKeyFrameTimes } from '@/pipeline/keyFrameExtraction';
import { downloadMergedVideo } from '@/pipeline/ytDlp';
import type { TranscriptSegment } from '@/transcript/types';

export type KeyFramePipelineResult = {
    /** Relative to artifact directory, e.g. `keyframes`. */
    relativeDir: string;
    /** Basenames only (e.g. `frame-001.jpg`). */
    files: string[];
    timesSec: number[];
};

/**
 * Downloads merged video to a temp dir, extracts JPEG stills into `artifactDir/keyframes`, removes temp video.
 */
export async function downloadVideoAndExtractKeyFrames(options: {
    url: string;
    videoId: string;
    segments: readonly TranscriptSegment[];
    artifactDir: string;
    maxFrames: number;
    minIntervalSec: number;
}): Promise<KeyFramePipelineResult> {
    const timesSec = sampleKeyFrameTimes(
        options.segments,
        options.maxFrames,
        options.minIntervalSec
    );
    if (timesSec.length === 0) {
        return { relativeDir: 'keyframes', files: [], timesSec: [] };
    }

    const workDir = await mkdtemp(path.join(os.tmpdir(), 'yt-keyframes-'));
    try {
        const videoPath = await downloadMergedVideo(options.url, workDir, options.videoId);
        const relativeDir = 'keyframes';
        const outDir = path.join(options.artifactDir, relativeDir);
        await mkdir(outDir, { recursive: true });
        const basenames = await extractKeyFrameStills({
            videoPath,
            outDir,
            timesSec
        });
        return { relativeDir, files: basenames, timesSec };
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
