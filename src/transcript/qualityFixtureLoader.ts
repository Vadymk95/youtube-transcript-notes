import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TranscriptSegment } from '@/transcript/types';

export type TranscriptQualityFixture = {
    id: string;
    description: string;
    language?: string;
    tags?: string[];
    sourceKind?: 'synthetic' | 'real-world';
    segments: TranscriptSegment[];
    requiredPhrases?: string[];
    expectedSegmentCount?: number;
    minSegmentReduction?: number;
    maxAdjacentOverlapPairs?: number;
    maxAdjacentPrefixPairs?: number;
    maxSegmentWords?: number;
};

const TRANSCRIPT_QUALITY_FIXTURES_DIR = fileURLToPath(
    new URL('../../fixtures/transcript-quality/', import.meta.url)
);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function readOptionalStringArray(
    value: unknown,
    fieldName: string,
    filePath: string
): string[] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error(`${filePath}: "${fieldName}" must be an array of strings`);
    }
    return value;
}

function readOptionalNumber(
    value: unknown,
    fieldName: string,
    filePath: string
): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${filePath}: "${fieldName}" must be a finite number`);
    }
    return value;
}

function parseSegment(value: unknown, index: number, filePath: string): TranscriptSegment {
    if (!isRecord(value)) {
        throw new Error(`${filePath}: segment #${index} must be an object`);
    }

    const { startSec, endSec, text } = value;
    if (typeof startSec !== 'number' || !Number.isFinite(startSec)) {
        throw new Error(`${filePath}: segment #${index} has invalid "startSec"`);
    }
    if (typeof endSec !== 'number' || !Number.isFinite(endSec)) {
        throw new Error(`${filePath}: segment #${index} has invalid "endSec"`);
    }
    if (typeof text !== 'string' || text.trim() === '') {
        throw new Error(`${filePath}: segment #${index} has invalid "text"`);
    }

    return { startSec, endSec, text };
}

function parseFixture(json: unknown, filePath: string): TranscriptQualityFixture {
    if (!isRecord(json)) {
        throw new Error(`${filePath}: fixture must be an object`);
    }

    const { id, description, language, tags, sourceKind, segments, requiredPhrases } = json;
    if (typeof id !== 'string' || id.trim() === '') {
        throw new Error(`${filePath}: "id" must be a non-empty string`);
    }
    if (typeof description !== 'string' || description.trim() === '') {
        throw new Error(`${filePath}: "description" must be a non-empty string`);
    }
    if (language !== undefined && typeof language !== 'string') {
        throw new Error(`${filePath}: "language" must be a string when present`);
    }
    if (sourceKind !== undefined && sourceKind !== 'synthetic' && sourceKind !== 'real-world') {
        throw new Error(`${filePath}: "sourceKind" must be "synthetic" or "real-world"`);
    }
    if (!Array.isArray(segments) || segments.length === 0) {
        throw new Error(`${filePath}: "segments" must be a non-empty array`);
    }

    return {
        id,
        description,
        language,
        tags: readOptionalStringArray(tags, 'tags', filePath),
        sourceKind,
        segments: segments.map((segment, index) => parseSegment(segment, index, filePath)),
        requiredPhrases: readOptionalStringArray(requiredPhrases, 'requiredPhrases', filePath),
        expectedSegmentCount: readOptionalNumber(
            json.expectedSegmentCount,
            'expectedSegmentCount',
            filePath
        ),
        minSegmentReduction: readOptionalNumber(
            json.minSegmentReduction,
            'minSegmentReduction',
            filePath
        ),
        maxAdjacentOverlapPairs: readOptionalNumber(
            json.maxAdjacentOverlapPairs,
            'maxAdjacentOverlapPairs',
            filePath
        ),
        maxAdjacentPrefixPairs: readOptionalNumber(
            json.maxAdjacentPrefixPairs,
            'maxAdjacentPrefixPairs',
            filePath
        ),
        maxSegmentWords: readOptionalNumber(json.maxSegmentWords, 'maxSegmentWords', filePath)
    };
}

async function listFixtureFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                return listFixtureFiles(fullPath);
            }
            return entry.name.endsWith('.json') ? [fullPath] : [];
        })
    );
    return nested.flat().sort();
}

export async function loadTranscriptQualityFixtures(): Promise<TranscriptQualityFixture[]> {
    const filePaths = await listFixtureFiles(TRANSCRIPT_QUALITY_FIXTURES_DIR);
    const fixtures = await Promise.all(
        filePaths.map(async (filePath) => {
            const raw = await readFile(filePath, 'utf8');
            return parseFixture(JSON.parse(raw), filePath);
        })
    );

    const ids = new Set<string>();
    for (const fixture of fixtures) {
        if (ids.has(fixture.id)) {
            throw new Error(`Duplicate transcript quality fixture id: ${fixture.id}`);
        }
        ids.add(fixture.id);
    }

    return fixtures;
}
