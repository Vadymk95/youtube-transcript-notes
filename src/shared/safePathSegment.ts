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

const CYRILLIC_TRANSLIT: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya'
};

function transliterateCyrillic(text: string): string {
    let out = '';
    for (const ch of text) {
        out += CYRILLIC_TRANSLIT[ch] ?? ch;
    }
    return out;
}

/**
 * ASCII slug for a single filesystem path segment.
 * Lowercases, strips diacritics, transliterates basic Cyrillic, collapses non-alphanumerics to `-`,
 * and trims to `maxLen` at the last word boundary. Returns `''` when the input has no usable chars
 * (e.g. emoji-only title) — callers must fall back to the raw id.
 */
export function slugifyForPath(text: string, maxLen = 50): string {
    if (typeof text !== 'string') {
        return '';
    }
    const lower = text.toLowerCase();
    const stripped = lower.normalize('NFKD').replace(/\p{M}+/gu, '');
    const transliterated = transliterateCyrillic(stripped);
    const dashed = transliterated.replace(/[^a-z0-9]+/g, '-');
    const trimmed = dashed.replace(/^-+|-+$/g, '');
    if (trimmed.length <= maxLen) {
        return trimmed;
    }
    const sliced = trimmed.slice(0, maxLen);
    const lastDash = sliced.lastIndexOf('-');
    const wordBoundaryThreshold = Math.floor(maxLen / 2);
    const cut = lastDash > wordBoundaryThreshold ? sliced.slice(0, lastDash) : sliced;
    return cut.replace(/-+$/g, '');
}

export type ArtifactDirNameOptions = {
    /** Maximum slug length before joining the short id (default 50). */
    maxSlugLen?: number;
    /** How many leading chars of `videoId` to append after the slug (default 6). */
    shortIdLen?: number;
};

/**
 * Builds a human-readable artifact directory segment of the form `<slug>-<videoId[:shortIdLen]>`.
 * Falls back to the raw `videoId` when the title slug is empty (non-ASCII or emoji-only titles).
 * Always validates the final name with `assertSafeVideoIdForPath` so callers can use it directly
 * as a single path segment.
 */
export function buildArtifactDirName(
    videoTitle: string,
    videoId: string,
    options?: ArtifactDirNameOptions
): string {
    const maxSlugLen = options?.maxSlugLen ?? 50;
    const shortIdLen = options?.shortIdLen ?? 6;
    const trimmedId = typeof videoId === 'string' ? videoId.trim() : '';
    const slug = slugifyForPath(videoTitle ?? '', maxSlugLen);
    const shortId = trimmedId.slice(0, shortIdLen);
    const name = slug.length === 0 ? trimmedId : `${slug}-${shortId}`;
    assertSafeVideoIdForPath(name);
    return name;
}
