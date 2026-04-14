import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { debuglog } from 'node:util';

import { runCmd } from '@/shared/runCmd';
import { assertSafeVideoIdForPath } from '@/shared/safePathSegment';

const debugYtDlpAttempt = debuglog('yt-transcript:ytdlp');

const YT_DLP = process.env.YT_DLP_BIN ?? 'yt-dlp';

/**
 * Comma-separated list for yt-dlp `--sub-langs`. Avoid `all`: it triggers hundreds of
 * subtitle requests and often hits HTTP 429 from YouTube.
 * Override with `YT_TRANSCRIPT_SUB_LANGS` (e.g. `all,-live_chat` if you accept the risk).
 */
const DEFAULT_SUB_LANGS = 'en,en-US,en-orig,ru,uk,-live_chat';

/** Default backoff before one 429 retry per subtitle language (see `YT_TRANSCRIPT_SUB_429_RETRY_MS`). */
export const DEFAULT_SUB_429_RETRY_MS = 3500;

/**
 * Parses `YT_TRANSCRIPT_SUB_429_RETRY_MS`: unset or empty → default; invalid number → default;
 * finite values are clamped to ≥ 0. Exported for unit tests.
 */
export function parseSub429RetryMs(raw: string | undefined): number {
    const trimmed = raw?.trim() ?? '';
    if (trimmed === '') {
        return DEFAULT_SUB_429_RETRY_MS;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
        return DEFAULT_SUB_429_RETRY_MS;
    }
    return Math.max(0, n);
}

function subLangsRaw(): string {
    const env = process.env.YT_TRANSCRIPT_SUB_LANGS?.trim();
    return env && env.length > 0 ? env : DEFAULT_SUB_LANGS;
}

/**
 * Builds one `--sub-langs` value per attempt: each positive language is tried separately
 * (with exclusions like `-live_chat` appended every time) to reduce burst 429s. If the list
 * contains `all`, returns a single combined value — sequentializing `all` is meaningless.
 * Exported for unit tests.
 */
export function buildSequentialSubLangAttempts(rawList: string): string[] {
    const tokens = rawList
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    const exclusions = tokens.filter((t) => t.startsWith('-'));
    const positives = tokens.filter((t) => !t.startsWith('-'));

    if (positives.length === 0) {
        return [rawList.trim()];
    }
    if (positives.includes('all')) {
        return [tokens.join(',')];
    }

    return positives.map((p) => (exclusions.length > 0 ? [p, ...exclusions].join(',') : p));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimited(message: string): boolean {
    return /\b429\b/.test(message) || /Too Many Requests/i.test(message);
}

function combineExecError(e: unknown): string {
    let message = e instanceof Error ? e.message : String(e);
    if (typeof e === 'object' && e !== null && 'stderr' in e) {
        const stderr = (e as { stderr?: unknown }).stderr;
        if (typeof stderr === 'string' && stderr.trim().length > 0) {
            message = `${message}\n${stderr}`;
        }
    }
    return message;
}

async function runYtDlpSubtitleAttempt(
    args: string[],
    cwd: string
): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
        await runCmd(YT_DLP, args, { cwd });
        return { ok: true };
    } catch (e: unknown) {
        const message = combineExecError(e);
        debugYtDlpAttempt('subtitle download attempt failed: %s', message);
        if (process.env.YT_TRANSCRIPT_DEBUG) {
            console.error(`[yt-transcript] yt-dlp: ${message}`);
        }
        return { ok: false, message };
    }
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
    const idRaw = typeof o.id === 'string' ? o.id : '';
    if (!idRaw.trim()) {
        throw new Error('yt-dlp did not return video id');
    }
    const id = idRaw.trim();
    assertSafeVideoIdForPath(id);
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

async function downloadSubsWithWriter(
    url: string,
    workDir: string,
    writerFlag: '--write-subs' | '--write-auto-subs',
    subDirSegment: string,
    kind: 'manual' | 'auto'
): Promise<SubtitleAttempt> {
    const subDir = path.join(workDir, subDirSegment);
    await mkdir(subDir, { recursive: true });

    const attempts = buildSequentialSubLangAttempts(subLangsRaw());
    const retryMs = parseSub429RetryMs(process.env.YT_TRANSCRIPT_SUB_429_RETRY_MS);

    for (const subLangs of attempts) {
        let rateLimitRetries = 0;
        while (true) {
            const result = await runYtDlpSubtitleAttempt(
                [
                    '--skip-download',
                    '--no-warnings',
                    writerFlag,
                    '--sub-format',
                    'vtt',
                    '--sub-langs',
                    subLangs,
                    '-o',
                    path.join(subDir, '%(id)s.%(language)s'),
                    url
                ],
                workDir
            );

            const files = await listVttFiles(subDir);
            if (files.length > 0) {
                return { kind, files };
            }

            if (result.ok) {
                break;
            }

            if (rateLimitRetries === 0 && isRateLimited(result.message)) {
                rateLimitRetries++;
                if (retryMs > 0) {
                    await sleep(retryMs);
                }
                continue;
            }
            break;
        }
    }

    const files = await listVttFiles(subDir);
    return { kind, files };
}

export async function downloadManualSubs(url: string, workDir: string): Promise<SubtitleAttempt> {
    return downloadSubsWithWriter(url, workDir, '--write-subs', 'manual-subs', 'manual');
}

export async function downloadAutoSubs(url: string, workDir: string): Promise<SubtitleAttempt> {
    return downloadSubsWithWriter(url, workDir, '--write-auto-subs', 'auto-subs', 'auto');
}

/**
 * Downloads a merged video file (best video+audio mux) for ffmpeg frame extraction.
 * Heavier than audio-only; use only when key frames are enabled.
 */
export async function downloadMergedVideo(
    url: string,
    workDir: string,
    videoId: string
): Promise<string> {
    const outTemplate = path.join(workDir, `${videoId}.%(ext)s`);
    await runCmd(
        YT_DLP,
        [
            '--no-warnings',
            '-f',
            'bv*+ba/bestvideo+bestaudio/best',
            '--merge-output-format',
            'mp4',
            '-o',
            outTemplate,
            url
        ],
        { cwd: workDir }
    );

    const names = await readdir(workDir);
    const merged = names.find(
        (n) =>
            n.startsWith(videoId) &&
            (n.endsWith('.mp4') || n.endsWith('.mkv') || n.endsWith('.webm'))
    );
    if (!merged) {
        throw new Error(
            `Merged video file not found for video id ${videoId} after yt-dlp download`
        );
    }
    return path.join(workDir, merged);
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
        throw new Error(`Audio file not found for video id ${videoId}`);
    }
    return path.join(workDir, audio);
}
