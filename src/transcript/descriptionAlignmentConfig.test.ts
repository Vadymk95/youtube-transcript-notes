import { afterEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS,
    descriptionAlignmentPatchFromCli,
    mergeDescriptionAlignment,
    resolveDescriptionAlignmentFromEnv
} from '@/transcript/descriptionAlignmentConfig';

describe('resolveDescriptionAlignmentFromEnv', () => {
    const prev: Record<string, string | undefined> = {};

    afterEach(() => {
        for (const k of Object.keys(prev)) {
            const v = prev[k];
            if (v === undefined) {
                delete process.env[k];
            } else {
                process.env[k] = v;
            }
        }
    });

    function stash(key: string): void {
        if (!(key in prev)) {
            prev[key] = process.env[key];
        }
    }

    it('uses built-in defaults when env is empty', () => {
        stash('YT_TRANSCRIPT_DESC_ALIGN_POLICY');
        stash('YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP');
        stash('YT_TRANSCRIPT_DESC_ALIGN_MIN_TOKENS');
        stash('YT_TRANSCRIPT_DESC_ALIGN_MIN_CHARS');
        delete process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY;
        delete process.env.YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP;
        delete process.env.YT_TRANSCRIPT_DESC_ALIGN_MIN_TOKENS;
        delete process.env.YT_TRANSCRIPT_DESC_ALIGN_MIN_CHARS;

        const r = resolveDescriptionAlignmentFromEnv(process.env);
        expect(r.policy).toBe('heuristic');
        expect(r.thresholds).toEqual(DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS);
    });

    it('parses always_include policy aliases', () => {
        stash('YT_TRANSCRIPT_DESC_ALIGN_POLICY');
        process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY = 'off';
        expect(resolveDescriptionAlignmentFromEnv(process.env).policy).toBe('always_include');
        process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY = 'include';
        expect(resolveDescriptionAlignmentFromEnv(process.env).policy).toBe('always_include');
    });

    it('parses numeric overrides', () => {
        stash('YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP');
        stash('YT_TRANSCRIPT_DESC_ALIGN_MIN_TOKENS');
        stash('YT_TRANSCRIPT_DESC_ALIGN_MIN_CHARS');
        process.env.YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP = '0.2';
        process.env.YT_TRANSCRIPT_DESC_ALIGN_MIN_TOKENS = '5';
        process.env.YT_TRANSCRIPT_DESC_ALIGN_MIN_CHARS = '100';

        const r = resolveDescriptionAlignmentFromEnv(process.env);
        expect(r.thresholds.minOverlapToKeepYaml).toBe(0.2);
        expect(r.thresholds.minDescriptionTokensBeforeJudge).toBe(5);
        expect(r.thresholds.minDescriptionCharsBeforeJudge).toBe(100);
    });

    it('falls back to heuristic policy when env policy is unknown', () => {
        stash('YT_TRANSCRIPT_DESC_ALIGN_POLICY');
        process.env.YT_TRANSCRIPT_DESC_ALIGN_POLICY = 'not-a-real-policy';
        expect(resolveDescriptionAlignmentFromEnv(process.env).policy).toBe('heuristic');
    });

    it('falls back to default overlap when env overlap is out of range', () => {
        stash('YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP');
        process.env.YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP = '99';
        expect(
            resolveDescriptionAlignmentFromEnv(process.env).thresholds.minOverlapToKeepYaml
        ).toBe(DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS.minOverlapToKeepYaml);
    });
});

describe('mergeDescriptionAlignment', () => {
    it('overrides only provided threshold keys', () => {
        const base = resolveDescriptionAlignmentFromEnv({
            YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP: '0.2'
        });
        const merged = mergeDescriptionAlignment(base, {
            thresholds: { minDescriptionTokensBeforeJudge: 3 }
        });
        expect(merged.thresholds.minOverlapToKeepYaml).toBe(0.2);
        expect(merged.thresholds.minDescriptionTokensBeforeJudge).toBe(3);
        expect(merged.thresholds.minDescriptionCharsBeforeJudge).toBe(
            DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS.minDescriptionCharsBeforeJudge
        );
    });

    it('overrides policy without changing unspecified thresholds', () => {
        const base = resolveDescriptionAlignmentFromEnv({});
        const merged = mergeDescriptionAlignment(base, { policy: 'always_include' });
        expect(merged.policy).toBe('always_include');
        expect(merged.thresholds).toEqual(base.thresholds);
    });
});

describe('descriptionAlignmentPatchFromCli', () => {
    it('returns undefined when no flags set', () => {
        expect(descriptionAlignmentPatchFromCli({})).toBeUndefined();
    });

    it('throws on invalid policy', () => {
        expect(() => descriptionAlignmentPatchFromCli({ 'desc-align-policy': 'nope' })).toThrow(
            /Invalid --desc-align-policy/
        );
    });

    it('throws on overlap out of range', () => {
        expect(() => descriptionAlignmentPatchFromCli({ 'desc-align-min-overlap': '2' })).toThrow(
            /--desc-align-min-overlap/
        );
        expect(() => descriptionAlignmentPatchFromCli({ 'desc-align-min-overlap': '0' })).toThrow(
            /--desc-align-min-overlap/
        );
    });

    it('throws on non-positive token or char thresholds', () => {
        expect(() => descriptionAlignmentPatchFromCli({ 'desc-align-min-tokens': '0' })).toThrow(
            /--desc-align-min-tokens/
        );
        expect(() => descriptionAlignmentPatchFromCli({ 'desc-align-min-chars': '0' })).toThrow(
            /--desc-align-min-chars/
        );
    });
});
