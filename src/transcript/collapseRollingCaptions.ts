import type { TranscriptSegment } from './types.js';

const MAX_TIME_GAP_SEC = 1;
const MAX_OVERLAP_WINDOW_WORDS = 18;
const MAX_FRAGMENT_WORDS = 28;
const MIN_FRAGMENT_JOIN_OVERLAP_WORDS = 2;
const MIN_FRAGMENT_JOIN_OVERLAP_CHARS = 12;
const MIN_OVERLAP_WORDS = 4;
const MIN_OVERLAP_CHARS = 16;
const MIN_OVERLAP_RATIO = 0.35;
const MIN_DUPLICATE_SUFFIX_WORDS = 2;
const MIN_DUPLICATE_SUFFIX_CHARS = 8;

function norm(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

function normalizeWord(word: string): string {
    const normalized = word.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
    return normalized || word.toLowerCase();
}

function tokenize(text: string): { raw: string[]; normalized: string[] } {
    const raw = norm(text)
        .split(' ')
        .map((word) => word.trim())
        .filter(Boolean);
    return {
        raw,
        normalized: raw.map(normalizeWord)
    };
}

function findSuffixPrefixOverlap(
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

function endsWithSentenceBoundary(text: string): boolean {
    return /[.!?]["')\]]*$/.test(norm(text));
}

function wordCount(text: string): number {
    return tokenize(text).normalized.length;
}

function startsLikeContinuation(text: string): boolean {
    return /^[("'[-]*[\p{Ll}\p{N}]/u.test(norm(text));
}

function collapsePrefixChains(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
    const out: TranscriptSegment[] = [];
    let i = 0;
    while (i < segments.length) {
        const first = segments[i]!;
        const startSec = first.startSec;
        let endSec = first.endSec;
        let text = first.text;
        let n = norm(text);
        let j = i + 1;
        while (j < segments.length) {
            const next = segments[j]!;
            const nn = norm(next.text);
            if (!nn.startsWith(n)) {
                break;
            }
            endSec = next.endSec;
            text = next.text;
            n = nn;
            j += 1;
        }
        out.push({ startSec, endSec, text });
        i = j;
    }
    return out;
}

function shouldTrimSlidingWindow(current: TranscriptSegment, next: TranscriptSegment): boolean {
    if (next.startSec - current.endSec > MAX_TIME_GAP_SEC) {
        return false;
    }

    const overlap = findSuffixPrefixOverlap(current.text, next.text);
    if (overlap.wordCount === 0) {
        return false;
    }

    const currentWordCount = tokenize(current.text).normalized.length;
    const nextWordCount = tokenize(next.text).normalized.length;
    if (overlap.wordCount === nextWordCount) {
        return (
            overlap.wordCount >= MIN_DUPLICATE_SUFFIX_WORDS &&
            overlap.charCount >= MIN_DUPLICATE_SUFFIX_CHARS
        );
    }

    if (endsWithSentenceBoundary(current.text) && overlap.wordCount === currentWordCount) {
        return false;
    }

    if (
        endsWithSentenceBoundary(current.text) &&
        overlap.wordCount < MIN_OVERLAP_WORDS + 2 &&
        overlap.ratio < 0.5
    ) {
        return false;
    }

    return (
        overlap.wordCount >= MIN_OVERLAP_WORDS &&
        overlap.charCount >= MIN_OVERLAP_CHARS &&
        overlap.ratio >= MIN_OVERLAP_RATIO
    );
}

function trimSlidingWindow(
    current: TranscriptSegment,
    next: TranscriptSegment
): TranscriptSegment | null {
    const nextTokens = tokenize(next.text);
    const overlap = findSuffixPrefixOverlap(current.text, next.text);
    const tailWords = nextTokens.raw.slice(overlap.wordCount);
    if (tailWords.length === 0) {
        return null;
    }

    return {
        startSec: next.startSec,
        endSec: next.endSec,
        text: tailWords.join(' ')
    };
}

function collapseSlidingWindows(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
    if (segments.length === 0) {
        return [];
    }

    const out: TranscriptSegment[] = [];
    let previousSource = segments[0]!;
    out.push({ ...previousSource });

    for (let i = 1; i < segments.length; i += 1) {
        const nextSource = segments[i]!;
        if (!shouldTrimSlidingWindow(previousSource, nextSource)) {
            out.push({ ...nextSource });
            previousSource = nextSource;
            continue;
        }

        const trimmed = trimSlidingWindow(previousSource, nextSource);
        if (trimmed === null) {
            const last = out[out.length - 1];
            if (last) {
                last.endSec = Math.max(last.endSec, nextSource.endSec);
            }
            previousSource = nextSource;
            continue;
        }

        out.push(trimmed);
        previousSource = nextSource;
    }

    return out;
}

function mergeReadableFragments(segments: readonly TranscriptSegment[]): TranscriptSegment[] {
    if (segments.length === 0) {
        return [];
    }

    const out: TranscriptSegment[] = [];
    let current: TranscriptSegment = { ...segments[0]! };

    for (let i = 1; i < segments.length; i += 1) {
        const next = segments[i]!;
        if (
            next.startSec - current.endSec > MAX_TIME_GAP_SEC ||
            endsWithSentenceBoundary(current.text) ||
            wordCount(current.text) >= MAX_FRAGMENT_WORDS ||
            !startsLikeContinuation(next.text)
        ) {
            out.push(current);
            current = { ...next };
            continue;
        }

        const overlap = findSuffixPrefixOverlap(current.text, next.text);
        const nextTokens = tokenize(next.text);
        const tailWords =
            overlap.wordCount >= MIN_FRAGMENT_JOIN_OVERLAP_WORDS &&
            overlap.charCount >= MIN_FRAGMENT_JOIN_OVERLAP_CHARS
                ? nextTokens.raw.slice(overlap.wordCount)
                : nextTokens.raw;

        current = {
            startSec: current.startSec,
            endSec: next.endSec,
            text: norm(`${current.text} ${tailWords.join(' ')}`)
        };
    }

    out.push(current);
    return out;
}

/**
 * YouTube auto-generated WebVTT often uses rolling cues: each cue repeats the
 * previous text and appends more words (live-caption style). Parsing yields many
 * nearly-duplicate lines. First merge prefix-extension chains, then trim or drop
 * sliding-window updates when a cue repeats a long suffix from the previous cue.
 *
 * Applied only to `subtitle-auto` in the pipeline — manual tracks rarely use
 * this pattern, and aggressive overlap trimming could remove legitimate repeated
 * phrasing that happens across sentence boundaries.
 */
export function collapseRollingAutoCaptions(
    segments: readonly TranscriptSegment[]
): TranscriptSegment[] {
    if (segments.length === 0) {
        return [];
    }
    return mergeReadableFragments(collapseSlidingWindows(collapsePrefixChains(segments)));
}
