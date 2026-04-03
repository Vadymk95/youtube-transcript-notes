/**
 * Shared suffix/prefix overlap between adjacent caption lines.
 * Used by `collapseRollingAutoCaptions` and `qualityHarness` metrics so
 * regression counts stay aligned with cleanup heuristics.
 */

export const MAX_OVERLAP_WINDOW_WORDS = 18;

/** Minimum word overlap treated as a sliding-window repetition (metrics + trim gate). */
export const MIN_OVERLAP_WORDS = 4;

export function norm(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

export function normalizeWord(word: string): string {
    const normalized = word.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
    return normalized || word.toLowerCase();
}

export function tokenize(text: string): { raw: string[]; normalized: string[] } {
    const raw = norm(text)
        .split(' ')
        .map((word) => word.trim())
        .filter(Boolean);
    return {
        raw,
        normalized: raw.map(normalizeWord)
    };
}

export function findSuffixPrefixOverlap(
    currentText: string,
    nextText: string
): { wordCount: number; charCount: number; ratio: number } {
    const current = tokenize(currentText);
    const next = tokenize(nextText);
    const limit = Math.min(
        current.normalized.length,
        next.normalized.length,
        MAX_OVERLAP_WINDOW_WORDS
    );

    for (let size = limit; size >= 1; size -= 1) {
        let matches = true;
        for (let i = 0; i < size; i += 1) {
            if (current.normalized[current.normalized.length - size + i] !== next.normalized[i]) {
                matches = false;
                break;
            }
        }
        if (!matches) {
            continue;
        }

        const overlapText = next.raw.slice(0, size).join(' ');
        return {
            wordCount: size,
            charCount: overlapText.length,
            ratio: size / Math.min(current.normalized.length, next.normalized.length)
        };
    }

    return { wordCount: 0, charCount: 0, ratio: 0 };
}
