/** Stable prefix for tests and log filtering. */
export const INVALID_VIDEO_ID_PREFIX = 'Invalid video id for local paths:';

/**
 * Rejects ids that are unsafe as a single filesystem path segment (traversal, NUL, etc.).
 * Does not require YouTube's 11-char pattern — non-YouTube extractors may use numeric or mixed ids.
 */
export function assertSafeVideoIdForPath(id: string): void {
    if (typeof id !== 'string') {
        throw new Error(`${INVALID_VIDEO_ID_PREFIX} expected a string`);
    }
    const s = id.trim();
    if (s.length < 1 || s.length > 200) {
        throw new Error(`${INVALID_VIDEO_ID_PREFIX} length must be 1–200 after trim`);
    }
    if (s === '.' || s === '..') {
        throw new Error(`${INVALID_VIDEO_ID_PREFIX} reserved segment`);
    }
    if (s.startsWith('-')) {
        throw new Error(`${INVALID_VIDEO_ID_PREFIX} must not start with '-'`);
    }
    if (
        s.includes('/') ||
        s.includes('\\') ||
        s.includes('\0') ||
        s.includes('\n') ||
        s.includes('\r') ||
        s.includes('..')
    ) {
        throw new Error(`${INVALID_VIDEO_ID_PREFIX} contains forbidden characters or sequences`);
    }
    if (process.platform === 'win32') {
        for (const ch of [':', '*', '?', '"', '<', '>', '|']) {
            if (s.includes(ch)) {
                throw new Error(
                    `${INVALID_VIDEO_ID_PREFIX} contains forbidden characters or sequences`
                );
            }
        }
    }
}
