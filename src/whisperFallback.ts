import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseWebVtt } from './parseVtt.js';
import { runCmd } from './runCmd.js';
import type { TranscriptSegment } from './types.js';

export const DEFAULT_WHISPER_CMD =
    process.env.YT_TRANSCRIPT_WHISPER_CMD ??
    'whisper "{{audio}}" --output_dir "{{outdir}}" --model small --output_format vtt --language auto';

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
