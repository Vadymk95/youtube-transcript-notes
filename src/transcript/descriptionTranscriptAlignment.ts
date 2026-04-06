import {
    DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS,
    type DescriptionAlignmentThresholds
} from '@/transcript/descriptionAlignmentConfig';

/** English noise tokens — only used to score *page* description vs *spoken* transcript. */
const STOP = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'but',
    'by',
    'can',
    'did',
    'do',
    'for',
    'from',
    'had',
    'has',
    'have',
    'he',
    'her',
    'him',
    'his',
    'how',
    'if',
    'in',
    'into',
    'is',
    'it',
    'its',
    'may',
    'more',
    'not',
    'of',
    'on',
    'or',
    'our',
    'she',
    'than',
    'that',
    'the',
    'their',
    'them',
    'then',
    'there',
    'these',
    'they',
    'this',
    'to',
    'was',
    'we',
    'were',
    'what',
    'when',
    'where',
    'which',
    'who',
    'will',
    'with',
    'would',
    'you',
    'your'
]);

const URL_RE = /https?:\/\/[^\s)>\]]+/gi;

export type VideoDescriptionAlignment = 'high' | 'low';

export type DescriptionTranscriptAssessment = {
    alignment: VideoDescriptionAlignment;
    /** Fraction of counted description tokens found in transcript (0–1). */
    overlapRatio: number;
    /** Tokens used for the ratio (after URL strip + stop-word filter). */
    descriptionTokenCount: number;
};

function stripUrls(s: string): string {
    return s.replace(URL_RE, ' ');
}

function tokenize(text: string): string[] {
    const lower = stripUrls(text).toLowerCase();
    const out: string[] = [];
    const word = /\p{L}{2,}/gu;
    let m: RegExpExecArray | null;
    while ((m = word.exec(lower)) !== null) {
        out.push(m[0]);
    }
    return out;
}

function uniqueMeaningfulDescriptionTokens(description: string): string[] {
    const raw = tokenize(description);
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const t of raw) {
        if (STOP.has(t)) {
            continue;
        }
        if (!seen.has(t)) {
            seen.add(t);
            tokens.push(t);
        }
    }
    return tokens;
}

/**
 * Heuristic: YouTube's `description` field is often reused for channel promos unrelated to
 * what was said in the video. When overlap with the spoken transcript is very low, omit
 * the description from `transcript.md` YAML (full text remains in `manifest.json`).
 *
 * Thresholds default to `DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS`; override via env/CLI in the pipeline.
 */
export function assessVideoDescriptionAlignment(
    pageDescription: string,
    transcriptPlain: string,
    thresholds: DescriptionAlignmentThresholds = DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS
): DescriptionTranscriptAssessment {
    const trimmed = pageDescription.trim();
    if (trimmed === '') {
        return { alignment: 'high', overlapRatio: 1, descriptionTokenCount: 0 };
    }

    const descTokens = uniqueMeaningfulDescriptionTokens(trimmed);
    if (descTokens.length < thresholds.minDescriptionTokensBeforeJudge) {
        return { alignment: 'high', overlapRatio: 1, descriptionTokenCount: descTokens.length };
    }

    const transcriptTokenSet = new Set(tokenize(transcriptPlain));
    let hits = 0;
    for (const t of descTokens) {
        if (transcriptTokenSet.has(t)) {
            hits += 1;
        }
    }
    const overlapRatio = hits / descTokens.length;
    const lowByRatio =
        overlapRatio < thresholds.minOverlapToKeepYaml &&
        trimmed.length >= thresholds.minDescriptionCharsBeforeJudge;
    const alignment: VideoDescriptionAlignment = lowByRatio ? 'low' : 'high';

    return { alignment, overlapRatio, descriptionTokenCount: descTokens.length };
}
