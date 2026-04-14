import { readFile } from 'node:fs/promises';

/**
 * Parse one URL per line for `agent:prepare --batch-file`.
 * Empty lines and `#` comments are skipped.
 */
export function parseBatchUrlLines(raw: string): string[] {
    const out: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (t === '' || t.startsWith('#')) {
            continue;
        }
        out.push(t);
    }
    return out;
}

/**
 * Read batch file contents. Use path `-` for stdin (e.g. pipe a file into the process).
 */
export async function readBatchFileContent(path: string): Promise<string> {
    if (path === '-') {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf8');
    }
    return readFile(path, 'utf8');
}
