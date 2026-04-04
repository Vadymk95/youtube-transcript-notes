import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { debuglog } from 'node:util';

import { runCmd } from '@/shared/runCmd';

const debugYtDlpAttempt = debuglog('yt-transcript:ytdlp');

const YT_DLP = process.env.YT_DLP_BIN ?? 'yt-dlp';

/**
 * Comma-separated list for yt-dlp `--sub-langs`. Avoid `all`: it triggers hundreds of
 * subtitle requests and often hits HTTP 429 from YouTube.
 * Override with `YT_TRANSCRIPT_SUB_LANGS` (e.g. `all,-live_chat` if you accept the risk).
 */
const DEFAULT_SUB_LANGS = 'en,en-US,en-orig,ru,uk,-live_chat';

function subLangsArg(): string {
    return process.env.YT_TRANSCRIPT_SUB_LANGS?.trim() || DEFAULT_SUB_LANGS;
}

export type VideoInfo = {
    id: string;
    title: string;
    /** YouTube video description (may include links). Empty string when absent. */
    description: string;
};

/**
 * Parses stdout from `yt-dlp --dump-single-json` (single video).
 * Exported for unit tests.
 */
export function parseVideoInfoFromDumpJson(stdout: string): VideoInfo {
    let data: unknown;
    try {
        data = JSON.parse(stdout.trim());
    } catch (cause) {
        throw new Error('yt-dlp did not return valid JSON for video metadata', { cause });
    }
    if (!data || typeof data !== 'object') {
        throw new Error('yt-dlp JSON metadata was not an object');
    }
    const o = data as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    if (!id) {
        throw new Error('yt-dlp did not return video id');
    }
    const title = typeof o.title === 'string' && o.title.trim() !== '' ? o.title : id;
    const description =
        typeof o.description === 'string' && o.description.trim() !== '' ? o.description : '';
    return { id, title, description };
}

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
    const { stdout } = await runCmd(YT_DLP, [
        '--skip-download',
        '--no-warnings',
        '--dump-single-json',
        url
    ]);
    return parseVideoInfoFromDumpJson(stdout);
}

async function listVttFiles(dir: string): Promise<string[]> {
    const names = await readdir(dir);
    return names.filter((n) => n.endsWith('.vtt')).map((n) => path.join(dir, n));
}

export type SubtitleAttempt = {
    kind: 'manual' | 'auto';
    files: string[];
};

async function tryRunYtDlp(args: string[], cwd: string): Promise<boolean> {
    try {
        await runCmd(YT_DLP, args, { cwd });
        return true;
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        debugYtDlpAttempt('subtitle download attempt failed: %s', msg);
        if (process.env.YT_TRANSCRIPT_DEBUG) {
            console.error(`[yt-transcript] yt-dlp: ${msg}`);
        }
        return false;
    }
}

export async function downloadManualSubs(url: string, workDir: string): Promise<SubtitleAttempt> {
    const subDir = path.join(workDir, 'manual-subs');
    await mkdir(subDir, { recursive: true });
    await tryRunYtDlp(
        [
            '--skip-download',
            '--no-warnings',
            '--write-subs',
            '--sub-format',
            'vtt',
            '--sub-langs',
            subLangsArg(),
            '-o',
            path.join(subDir, '%(id)s.%(language)s'),
            url
        ],
        workDir
    );

    const files = await listVttFiles(subDir);
    return { kind: 'manual', files };
}

export async function downloadAutoSubs(url: string, workDir: string): Promise<SubtitleAttempt> {
    const subDir = path.join(workDir, 'auto-subs');
    await mkdir(subDir, { recursive: true });
    await tryRunYtDlp(
        [
            '--skip-download',
            '--no-warnings',
            '--write-auto-subs',
            '--sub-format',
            'vtt',
            '--sub-langs',
            subLangsArg(),
            '-o',
            path.join(subDir, '%(id)s.%(language)s'),
            url
        ],
        workDir
    );

    const files = await listVttFiles(subDir);
    return { kind: 'auto', files };
}

export async function downloadAudio(
    url: string,
    workDir: string,
    videoId: string,
    audioFormat: string
): Promise<string> {
    const outTemplate = path.join(workDir, `${videoId}.%(ext)s`);
    await runCmd(
        YT_DLP,
        [
            '-x',
            '--audio-format',
            audioFormat,
            '--audio-quality',
            '0',
            '--no-warnings',
            '-o',
            outTemplate,
            url
        ],
        { cwd: workDir }
    );

    const names = await readdir(workDir);
    const audio = names.find(
        (n) =>
            n.startsWith(videoId) &&
            (n.endsWith(`.${audioFormat}`) ||
                n.endsWith('.m4a') ||
                n.endsWith('.opus') ||
                n.endsWith('.webm'))
    );
    if (!audio) {
        throw new Error(`Audio file not found in ${workDir} for id ${videoId}`);
    }
    return path.join(workDir, audio);
}
