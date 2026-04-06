/** Tunable thresholds for lexical overlap between page description and spoken transcript. */
export type DescriptionAlignmentThresholds = {
    /** Description tokens must match transcript at least this fraction to avoid `low` alignment. */
    minOverlapToKeepYaml: number;
    /** Below this many contentful description tokens, skip misalignment judgment (treat as aligned). */
    minDescriptionTokensBeforeJudge: number;
    /** With shorter page text than this, skip misalignment judgment (treat as aligned). */
    minDescriptionCharsBeforeJudge: number;
};

/** Whether YAML `description` may be omitted when lexical overlap is low. */
export type DescriptionAlignmentPolicy = 'heuristic' | 'always_include';

export type DescriptionAlignmentResolved = {
    policy: DescriptionAlignmentPolicy;
    thresholds: DescriptionAlignmentThresholds;
};

export const DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS: DescriptionAlignmentThresholds = {
    minOverlapToKeepYaml: 0.12,
    minDescriptionTokensBeforeJudge: 10,
    minDescriptionCharsBeforeJudge: 72
};

const DEFAULT_RESOLVED: DescriptionAlignmentResolved = {
    policy: 'heuristic',
    thresholds: DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS
};

function parsePolicy(raw: string | undefined): DescriptionAlignmentPolicy | undefined {
    if (raw === undefined || raw.trim() === '') {
        return undefined;
    }
    const v = raw.trim().toLowerCase();
    if (v === 'heuristic' || v === 'default' || v === 'on' || v === '1') {
        return 'heuristic';
    }
    if (v === 'always_include' || v === 'off' || v === '0' || v === 'include') {
        return 'always_include';
    }
    return undefined;
}

function parseOverlap(raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }
    const n = Number.parseFloat(raw.trim());
    if (!Number.isFinite(n) || n <= 0 || n > 1) {
        return fallback;
    }
    return n;
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number): number {
    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }
    const n = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(n) || n < min) {
        return fallback;
    }
    return n;
}

/**
 * Reads `YT_TRANSCRIPT_DESC_ALIGN_*` env (see README). Invalid values fall back to defaults
 * (same behavior as other transcript env parsers in this repo).
 */
export function resolveDescriptionAlignmentFromEnv(
    env: NodeJS.ProcessEnv = process.env
): DescriptionAlignmentResolved {
    const policy = parsePolicy(env.YT_TRANSCRIPT_DESC_ALIGN_POLICY) ?? DEFAULT_RESOLVED.policy;
    const thresholds: DescriptionAlignmentThresholds = {
        minOverlapToKeepYaml: parseOverlap(
            env.YT_TRANSCRIPT_DESC_ALIGN_MIN_OVERLAP,
            DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS.minOverlapToKeepYaml
        ),
        minDescriptionTokensBeforeJudge: parsePositiveInt(
            env.YT_TRANSCRIPT_DESC_ALIGN_MIN_TOKENS,
            DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS.minDescriptionTokensBeforeJudge,
            1
        ),
        minDescriptionCharsBeforeJudge: parsePositiveInt(
            env.YT_TRANSCRIPT_DESC_ALIGN_MIN_CHARS,
            DEFAULT_DESCRIPTION_ALIGNMENT_THRESHOLDS.minDescriptionCharsBeforeJudge,
            1
        )
    };
    return { policy, thresholds };
}

export type DescriptionAlignmentPatch = Partial<{
    policy: DescriptionAlignmentPolicy;
    thresholds: Partial<DescriptionAlignmentThresholds>;
}>;

/** Deep-merge patch over base (CLI / programmatic overrides). */
export function mergeDescriptionAlignment(
    base: DescriptionAlignmentResolved,
    patch: DescriptionAlignmentPatch | undefined
): DescriptionAlignmentResolved {
    if (patch === undefined) {
        return base;
    }
    const t = patch.thresholds;
    return {
        policy: patch.policy ?? base.policy,
        thresholds: {
            minOverlapToKeepYaml: t?.minOverlapToKeepYaml ?? base.thresholds.minOverlapToKeepYaml,
            minDescriptionTokensBeforeJudge:
                t?.minDescriptionTokensBeforeJudge ??
                base.thresholds.minDescriptionTokensBeforeJudge,
            minDescriptionCharsBeforeJudge:
                t?.minDescriptionCharsBeforeJudge ?? base.thresholds.minDescriptionCharsBeforeJudge
        }
    };
}

export type DescriptionAlignmentCliStrings = {
    'desc-align-policy'?: string | undefined;
    'desc-align-min-overlap'?: string | undefined;
    'desc-align-min-tokens'?: string | undefined;
    'desc-align-min-chars'?: string | undefined;
};

/**
 * Builds a patch from CLI flags. Throws if an explicitly given flag is invalid.
 * Omit all flags → `undefined` (use env only).
 */
export function descriptionAlignmentPatchFromCli(
    values: DescriptionAlignmentCliStrings
): DescriptionAlignmentPatch | undefined {
    const rawPolicy = values['desc-align-policy'];
    let policy: DescriptionAlignmentPolicy | undefined;
    if (rawPolicy !== undefined && rawPolicy.trim() !== '') {
        const p = parsePolicy(rawPolicy);
        if (p === undefined) {
            throw new Error(
                'Invalid --desc-align-policy (use heuristic | always_include | off | include)'
            );
        }
        policy = p;
    }

    const thresholds: Partial<DescriptionAlignmentThresholds> = {};
    const rawO = values['desc-align-min-overlap'];
    if (rawO !== undefined && rawO.trim() !== '') {
        const v = Number.parseFloat(rawO.trim());
        if (!Number.isFinite(v) || v <= 0 || v > 1) {
            throw new Error('--desc-align-min-overlap must be a number in (0, 1]');
        }
        thresholds.minOverlapToKeepYaml = v;
    }
    const rawTok = values['desc-align-min-tokens'];
    if (rawTok !== undefined && rawTok.trim() !== '') {
        const v = Number.parseInt(rawTok.trim(), 10);
        if (!Number.isFinite(v) || v < 1) {
            throw new Error('--desc-align-min-tokens must be a positive integer');
        }
        thresholds.minDescriptionTokensBeforeJudge = v;
    }
    const rawCh = values['desc-align-min-chars'];
    if (rawCh !== undefined && rawCh.trim() !== '') {
        const v = Number.parseInt(rawCh.trim(), 10);
        if (!Number.isFinite(v) || v < 1) {
            throw new Error('--desc-align-min-chars must be a positive integer');
        }
        thresholds.minDescriptionCharsBeforeJudge = v;
    }

    if (policy === undefined && Object.keys(thresholds).length === 0) {
        return undefined;
    }
    return {
        ...(policy !== undefined ? { policy } : {}),
        ...(Object.keys(thresholds).length > 0 ? { thresholds } : {})
    };
}
