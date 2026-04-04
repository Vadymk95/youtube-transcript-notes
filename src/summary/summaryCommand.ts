import { runCmd } from '@/shared/runCmd';

const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/;

/**
 * Inline placeholders into a user shell template (same pattern as Whisper).
 * All values should be absolute paths or safe strings — the command runs as `sh -c`.
 */
export function interpolateSummaryCommand(template: string, vars: Record<string, string>): string {
    let s = template;
    for (const [k, v] of Object.entries(vars)) {
        s = s.split(`{{${k}}}`).join(v);
    }
    const m = s.match(PLACEHOLDER);
    if (m) {
        throw new Error(
            `Unreplaced summary command placeholder "${m[0]}". Known keys: ${Object.keys(vars).sort().join(', ')}.`
        );
    }
    return s;
}

export async function runSummaryShellCommand(
    template: string,
    vars: Record<string, string>,
    options?: { maxBuffer?: number }
): Promise<void> {
    const cmd = interpolateSummaryCommand(template, vars);
    await runCmd('sh', ['-c', cmd], {
        maxBuffer: options?.maxBuffer ?? 128 * 1024 * 1024
    });
}
