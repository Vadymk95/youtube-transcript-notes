import {
    DEFAULT_REPLY_LANGUAGE_CODE,
    type SummaryOutputLanguageConfig,
    resolveSummaryOutputLanguage
} from '@/summary/outputLanguage';

export type SummaryValidationResult = {
    valid: boolean;
    errors: string[];
};

/** @deprecated Use `DEFAULT_REPLY_LANGUAGE_CODE`. */
export const DEFAULT_REPLY_LANGUAGE = DEFAULT_REPLY_LANGUAGE_CODE;

function sectionBody(content: string, heading: string, allHeadings: readonly string[]): string {
    const start = content.indexOf(heading);
    if (start < 0) {
        return '';
    }
    const afterHeading = start + heading.length;
    const nextHeadingIndex = allHeadings
        .map((candidate) => content.indexOf(candidate, afterHeading))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0];
    return content.slice(afterHeading, nextHeadingIndex ?? content.length).trim();
}

function hasExpectedLanguageText(content: string, config: SummaryOutputLanguageConfig): boolean {
    return config.contentScriptRegex.test(content);
}

function resolveValidationConfig(
    language?: string | SummaryOutputLanguageConfig
): SummaryOutputLanguageConfig {
    if (language !== undefined && typeof language === 'object') {
        return language;
    }
    return resolveSummaryOutputLanguage(typeof language === 'string' ? language : undefined);
}

export function validateSummary(
    content: string,
    language?: string | SummaryOutputLanguageConfig
): SummaryValidationResult {
    const cfg = resolveValidationConfig(language);
    const requiredHeadings = cfg.requiredHeadings;
    const requiredHandoffSubheadings = cfg.requiredHandoffSubheadings;
    const speculativeMarkers = cfg.speculativeMarkers;

    const [TOPIC_HEADING, OUTLINE_HEADING, IDEAS_HEADING, , GAPS_HEADING] = requiredHeadings;
    const [, , , RISKS_SUBHEADING] = requiredHandoffSubheadings;

    const errors: string[] = [];
    const trimmed = content.trim();

    if (trimmed.length === 0) {
        errors.push('Summary file is empty');
        return { valid: false, errors };
    }

    if (trimmed.includes('{{TRANSCRIPT}}')) {
        errors.push('Summary still contains the transcript placeholder');
    }

    if (!hasExpectedLanguageText(trimmed, cfg)) {
        errors.push(`Summary does not contain ${cfg.contentScriptLabel} text`);
    }

    for (const heading of requiredHeadings) {
        if (!trimmed.includes(heading)) {
            errors.push(`Missing required heading: ${heading}`);
        }
    }

    for (const heading of requiredHandoffSubheadings) {
        if (!trimmed.includes(heading)) {
            errors.push(`Missing required handoff subheading: ${heading}`);
        }
    }

    const outlineBody = sectionBody(trimmed, OUTLINE_HEADING, requiredHeadings);
    if (!/\n?1\.\s+/m.test(outlineBody)) {
        errors.push('Short outline must contain a numbered list');
    }

    const ideasBody = sectionBody(trimmed, IDEAS_HEADING, requiredHeadings);
    if (!/^\s*-\s+/m.test(ideasBody)) {
        errors.push('Main ideas must contain bullet points');
    }

    const topicBody = sectionBody(trimmed, TOPIC_HEADING, requiredHeadings);
    if (topicBody.length < 20) {
        errors.push('The video topic section is too short');
    }

    const gapsBody = sectionBody(trimmed, GAPS_HEADING, requiredHeadings).toLowerCase();
    const risksBody = sectionBody(trimmed, RISKS_SUBHEADING, [
        ...requiredHeadings,
        ...requiredHandoffSubheadings
    ]).toLowerCase();
    const groundedBody = trimmed
        .replace(sectionBody(trimmed, GAPS_HEADING, requiredHeadings), '')
        .replace(
            sectionBody(trimmed, RISKS_SUBHEADING, [
                ...requiredHeadings,
                ...requiredHandoffSubheadings
            ]),
            ''
        )
        .toLowerCase();

    for (const marker of speculativeMarkers) {
        if (groundedBody.includes(marker)) {
            errors.push(
                `Speculative wording is only allowed in ambiguity/risk sections: ${marker}`
            );
        }
        if (gapsBody.includes(marker) || risksBody.includes(marker)) {
            continue;
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/** @deprecated Use `validateSummary` (same behavior when language unset). */
export const validateRussianSummary = validateSummary;
