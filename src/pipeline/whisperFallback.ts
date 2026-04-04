import { access, constants, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { runCmd } from '@/shared/runCmd';
import { parseWebVtt } from '@/transcript/parseVtt';
import type { TranscriptSegment } from '@/transcript/types';

export const DEFAULT_WHISPER_CMD =
    process.env.YT_TRANSCRIPT_WHISPER_CMD ??
    'whisper "{{audio}}" --output_dir "{{outdir}}" --model small --output_format vtt --language auto';

/**
 * Best-effort first executable token for PATH checks. Returns null when the template is too
 * dynamic (leading `{{`) or obviously delegates to a shell (`sh -c`, pipes, etc.).
 */
export function extractWhisperExecutableForPreflight(template: string): string | null {
    const trimmed = template.trim();
    if (trimmed.includes('|')) {
        return null;
    }
    if (trimmed.length === 0) {
        return null;
    }
    if (/^['"]?\{\{/.test(trimmed)) {
        return null;
    }
    const tokenMatch = trimmed.match(/^(['"])((?:\\.|(?!\1).)*)\1|^(\S+)/);
    const token = (tokenMatch?.[2] ?? tokenMatch?.[3] ?? '').trim();
    if (!token || token.includes('{{')) {
        return null;
    }
    const lower = path.basename(token).toLowerCase();
    if (['sh', 'bash', 'zsh', 'fish', 'cmd', 'cmd.exe', 'pwsh', 'powershell'].includes(lower)) {
        return null;
    }
    return token;
}

function combineErrorMessage(e: unknown): string {
    let message = e instanceof Error ? e.message : String(e);
    if (typeof e === 'object' && e !== null && 'stderr' in e) {
        const stderr = (e as { stderr?: unknown }).stderr;
        if (typeof stderr === 'string' && stderr.trim().length > 0) {
            message = `${message}\n${stderr}`;
        }
    }
    return message;
}

/**
 * Ensures the Whisper CLI (first simple token of the template) exists before downloading audio.
 * Skips the check when the template is non-simple (pipes, shell indirection, leading placeholders).
 */
export async function assertWhisperCommandResolvable(template: string): Promise<void> {
    const bin = extractWhisperExecutableForPreflight(template);
    if (bin === null) {
        return;
    }
    const looksLikePath = bin.includes('/') || /^[a-z]:\\/i.test(bin);
    if (looksLikePath) {
        try {
            await access(bin, constants.F_OK);
        } catch {
            throw new Error(
                `Whisper fallback scheduled but executable not found: ${bin}\n` +
                    `Install Whisper or fix --whisper-cmd / YT_TRANSCRIPT_WHISPER_CMD. See docs/troubleshooting.md`
            );
        }
        return;
    }
    try {
        if (process.platform === 'win32') {
            await runCmd('where', [bin]);
        } else {
            await runCmd('sh', ['-c', `command -v -- ${JSON.stringify(bin)}`]);
        }
    } catch (e: unknown) {
        throw new Error(
            `Whisper fallback scheduled but "${bin}" was not found on PATH.\n` +
                `${combineErrorMessage(e)}\n` +
                `Install Whisper (e.g. openai-whisper CLI) or set YT_TRANSCRIPT_WHISPER_CMD. See docs/troubleshooting.md`
        );
    }
}

function interpolate(template: string, vars: Record<string, string>): string {
    let s = template;
    for (const [k, v] of Object.entries(vars)) {
        s = s.split(`{{${k}}}`).join(v);
    }
    return s;
}

/**
 * Runs a shell command (one string) so users can use pipes or custom CLIs.
 * Prefer `YT_TRANSCRIPT_WHISPER_CMD` with `{{audio}}` and `{{outdir}}`.
 */
export async function runWhisperToVtt(
    audioPath: string,
    outDir: string,
    commandTemplate: string
): Promise<string> {
    const cmd = interpolate(commandTemplate, {
        audio: audioPath,
        outdir: outDir
    });

    await runCmd('sh', ['-c', cmd], {
        cwd: outDir,
        maxBuffer: 128 * 1024 * 1024
    });

    const names = await readdir(outDir);
    const vtts = names.filter((n) => n.endsWith('.vtt'));
    if (vtts.length === 0) {
        throw new Error(`Whisper command produced no .vtt in ${outDir}. Command was: ${cmd}`);
    }

    const withPath = vtts.map((n) => path.join(outDir, n));
    const first = withPath[0];
    if (!first) {
        throw new Error(`No VTT paths resolved in ${outDir}`);
    }
    let newest = first;
    let newestM = 0;
    for (const p of withPath) {
        const st = await stat(p);
        if (st.mtimeMs > newestM) {
            newestM = st.mtimeMs;
            newest = p;
        }
    }
    return newest;
}

export async function loadSegmentsFromVttFile(vttPath: string): Promise<TranscriptSegment[]> {
    const raw = await readFile(vttPath, 'utf8');
    return parseWebVtt(raw);
}
