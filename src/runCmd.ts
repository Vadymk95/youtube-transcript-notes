import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type RunResult = {
    stdout: string;
    stderr: string;
};

export async function runCmd(
    file: string,
    args: readonly string[],
    options?: { cwd?: string; maxBuffer?: number }
): Promise<RunResult> {
    const maxBuffer = options?.maxBuffer ?? 64 * 1024 * 1024;
    const { stdout, stderr } = await execFileAsync(file, [...args], {
        cwd: options?.cwd,
        maxBuffer,
        encoding: 'utf8'
    });
    return { stdout, stderr };
}
