import { collapseRollingAutoCaptions } from '@/transcript/collapseRollingCaptions';
import { toPlainText } from '@/transcript/formatTranscript';
import {
    loadTranscriptQualityFixtures,
    type TranscriptQualityFixture
} from '@/transcript/qualityFixtureLoader';
import {
    findSuffixPrefixOverlap,
    MIN_OVERLAP_WORDS,
    norm,
    tokenize
} from '@/transcript/suffixPrefixOverlap';
import type { TranscriptSegment } from '@/transcript/types';

export type TranscriptQualityMetrics = {
    segmentCount: number;
    totalChars: number;
    adjacentPrefixPairs: number;
    adjacentOverlapPairs: number;
    maxSegmentWords: number;
    maxSegmentChars: number;
};

export type TranscriptQualityCheck = {
    name: string;
    ok: boolean;
    details: string;
};

export type TranscriptQualityFixtureResult = {
    fixture: TranscriptQualityFixture;
    baseline: TranscriptQualityMetrics;
    cleaned: TranscriptQualityMetrics;
    checks: TranscriptQualityCheck[];
    passed: boolean;
    cleanedSegments: TranscriptSegment[];
};

export type TranscriptQualityHarnessFilters = {
    fixtureId?: string;
    language?: string;
    tag?: string;
};

export function collectTranscriptQualityMetrics(
    segments: readonly TranscriptSegment[]
): TranscriptQualityMetrics {
    let adjacentPrefixPairs = 0;
    let adjacentOverlapPairs = 0;
    let maxSegmentWords = 0;
    let maxSegmentChars = 0;

    for (let i = 0; i < segments.length; i += 1) {
        const current = segments[i]!;
        const currentNorm = norm(current.text);
        maxSegmentWords = Math.max(maxSegmentWords, tokenize(current.text).normalized.length);
        maxSegmentChars = Math.max(maxSegmentChars, current.text.length);

        if (i === 0) {
            continue;
        }

        const previous = segments[i - 1]!;
        const previousNorm = norm(previous.text);
        if (currentNorm.startsWith(previousNorm) || previousNorm.startsWith(currentNorm)) {
            adjacentPrefixPairs += 1;
        }
        if (findSuffixPrefixOverlap(previous.text, current.text).wordCount >= MIN_OVERLAP_WORDS) {
            adjacentOverlapPairs += 1;
        }
    }

    return {
        segmentCount: segments.length,
        totalChars: segments.reduce((sum, segment) => sum + segment.text.length, 0),
        adjacentPrefixPairs,
        adjacentOverlapPairs,
        maxSegmentWords,
        maxSegmentChars
    };
}

function check(name: string, ok: boolean, details: string): TranscriptQualityCheck {
    return { name, ok, details };
}

export function evaluateTranscriptQualityFixture(
    fixture: TranscriptQualityFixture
): TranscriptQualityFixtureResult {
    const cleanedSegments = collapseRollingAutoCaptions(fixture.segments);
    const baseline = collectTranscriptQualityMetrics(fixture.segments);
    const cleaned = collectTranscriptQualityMetrics(cleanedSegments);
    const checks: TranscriptQualityCheck[] = [];

    checks.push(
        check(
            'segment-count-does-not-grow',
            cleaned.segmentCount <= baseline.segmentCount,
            `${cleaned.segmentCount} <= ${baseline.segmentCount}`
        )
    );
    checks.push(
        check(
            'plain-text-does-not-grow',
            cleaned.totalChars <= baseline.totalChars,
            `${cleaned.totalChars} <= ${baseline.totalChars}`
        )
    );
    checks.push(
        check(
            'adjacent-overlap-does-not-grow',
            cleaned.adjacentOverlapPairs <= baseline.adjacentOverlapPairs,
            `${cleaned.adjacentOverlapPairs} <= ${baseline.adjacentOverlapPairs}`
        )
    );
    checks.push(
        check(
            'adjacent-prefix-does-not-grow',
            cleaned.adjacentPrefixPairs <= baseline.adjacentPrefixPairs,
            `${cleaned.adjacentPrefixPairs} <= ${baseline.adjacentPrefixPairs}`
        )
    );

    if (fixture.expectedSegmentCount !== undefined) {
        checks.push(
            check(
                'expected-segment-count',
                cleaned.segmentCount === fixture.expectedSegmentCount,
                `${cleaned.segmentCount} === ${fixture.expectedSegmentCount}`
            )
        );
    }

    if (fixture.minSegmentReduction !== undefined) {
        const reduction = baseline.segmentCount - cleaned.segmentCount;
        checks.push(
            check(
                'minimum-segment-reduction',
                reduction >= fixture.minSegmentReduction,
                `${reduction} >= ${fixture.minSegmentReduction}`
            )
        );
    }

    if (fixture.maxAdjacentOverlapPairs !== undefined) {
        checks.push(
            check(
                'max-adjacent-overlap-pairs',
                cleaned.adjacentOverlapPairs <= fixture.maxAdjacentOverlapPairs,
                `${cleaned.adjacentOverlapPairs} <= ${fixture.maxAdjacentOverlapPairs}`
            )
        );
    }

    if (fixture.maxAdjacentPrefixPairs !== undefined) {
        checks.push(
            check(
                'max-adjacent-prefix-pairs',
                cleaned.adjacentPrefixPairs <= fixture.maxAdjacentPrefixPairs,
                `${cleaned.adjacentPrefixPairs} <= ${fixture.maxAdjacentPrefixPairs}`
            )
        );
    }

    if (fixture.maxSegmentWords !== undefined) {
        checks.push(
            check(
                'max-segment-words',
                cleaned.maxSegmentWords <= fixture.maxSegmentWords,
                `${cleaned.maxSegmentWords} <= ${fixture.maxSegmentWords}`
            )
        );
    }

    if (fixture.requiredPhrases && fixture.requiredPhrases.length > 0) {
        const plainText = toPlainText(cleanedSegments);
        for (const phrase of fixture.requiredPhrases) {
            checks.push(check(`contains:${phrase}`, plainText.includes(phrase), phrase));
        }
    }

    return {
        fixture,
        baseline,
        cleaned,
        checks,
        passed: checks.every((item) => item.ok),
        cleanedSegments
    };
}

export async function runTranscriptQualityHarness(
    filters: TranscriptQualityHarnessFilters = {}
): Promise<TranscriptQualityFixtureResult[]> {
    const fixtures = (await loadTranscriptQualityFixtures()).filter((fixture) => {
        if (filters.fixtureId !== undefined && fixture.id !== filters.fixtureId) {
            return false;
        }
        if (filters.language !== undefined && fixture.language !== filters.language) {
            return false;
        }
        if (filters.tag !== undefined && !fixture.tags?.includes(filters.tag)) {
            return false;
        }
        return true;
    });

    if (filters.fixtureId !== undefined && fixtures.length === 0) {
        throw new Error(`Unknown transcript quality fixture: ${filters.fixtureId}`);
    }

    return fixtures.map(evaluateTranscriptQualityFixture);
}
