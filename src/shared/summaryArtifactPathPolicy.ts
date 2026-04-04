import path from 'node:path';

/**
 * Ensures `summaryFile` is under `artifactsRoot` (both absolute, normalized).
 * Mitigates arbitrary read when the validator CLI is driven by automation.
 */
export function assertSummaryFileWithinArtifactsRoot(
    summaryFileAbs: string,
    artifactsRootAbs: string
): void {
    const rel = path.relative(artifactsRootAbs, summaryFileAbs);
    if (rel === '') {
        throw new Error(
            '--artifacts-root: summary path must be a file inside the root, not the root itself'
        );
    }
    if (path.isAbsolute(rel)) {
        throw new Error('--artifacts-root: summary file is not under the given artifacts root');
    }
    const parts = rel.split(path.sep);
    if (parts.includes('..') || rel.startsWith(`..${path.sep}`) || rel === '..') {
        throw new Error('--artifacts-root: summary path escapes the artifacts root');
    }
}
