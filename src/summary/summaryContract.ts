import { SUMMARY_OUTPUT_LANGUAGE } from '@/summary/outputLanguage';

export const DEFAULT_REPLY_LANGUAGE = SUMMARY_OUTPUT_LANGUAGE.code;
export const REQUIRED_SUMMARY_HEADINGS = SUMMARY_OUTPUT_LANGUAGE.requiredHeadings;
const REQUIRED_HANDOFF_SUBHEADINGS = SUMMARY_OUTPUT_LANGUAGE.requiredHandoffSubheadings;
const SPECULATIVE_MARKERS = SUMMARY_OUTPUT_LANGUAGE.speculativeMarkers;
const [TOPIC_HEADING, OUTLINE_HEADING, IDEAS_HEADING, , GAPS_HEADING] = REQUIRED_SUMMARY_HEADINGS;
const [, , , RISKS_SUBHEADING] = REQUIRED_HANDOFF_SUBHEADINGS;

export type SummaryValidationResult = {
    valid: boolean;
    errors: string[];
};

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

function hasExpectedLanguageText(content: string): boolean {
    return SUMMARY_OUTPUT_LANGUAGE.contentScriptRegex.test(content);
}

export function validateSummary(content: string): SummaryValidationResult {
    const errors: string[] = [];
    const trimmed = content.trim();

    if (trimmed.length === 0) {
        errors.push('Summary file is empty');
        return { valid: false, errors };
    }

    if (trimmed.includes('{{TRANSCRIPT}}')) {
        errors.push('Summary still contains the transcript placeholder');
    }

    if (!hasExpectedLanguageText(trimmed)) {
        errors.push(`Summary does not contain ${SUMMARY_OUTPUT_LANGUAGE.contentScriptLabel} text`);
    }

    for (const heading of REQUIRED_SUMMARY_HEADINGS) {
        if (!trimmed.includes(heading)) {
            errors.push(`Missing required heading: ${heading}`);
        }
    }

    for (const heading of REQUIRED_HANDOFF_SUBHEADINGS) {
        if (!trimmed.includes(heading)) {
            errors.push(`Missing required handoff subheading: ${heading}`);
        }
    }

    const outlineBody = sectionBody(trimmed, OUTLINE_HEADING, REQUIRED_SUMMARY_HEADINGS);
    if (!/\n?1\.\s+/m.test(outlineBody)) {
        errors.push('Short outline must contain a numbered list');
    }

    const ideasBody = sectionBody(trimmed, IDEAS_HEADING, REQUIRED_SUMMARY_HEADINGS);
    if (!/^\s*-\s+/m.test(ideasBody)) {
        errors.push('Main ideas must contain bullet points');
    }

    const topicBody = sectionBody(trimmed, TOPIC_HEADING, REQUIRED_SUMMARY_HEADINGS);
    if (topicBody.length < 20) {
        errors.push('The video topic section is too short');
    }

    const gapsBody = sectionBody(trimmed, GAPS_HEADING, REQUIRED_SUMMARY_HEADINGS).toLowerCase();
    const risksBody = sectionBody(trimmed, RISKS_SUBHEADING, [
        ...REQUIRED_SUMMARY_HEADINGS,
        ...REQUIRED_HANDOFF_SUBHEADINGS
    ]).toLowerCase();
    const groundedBody = trimmed
        .replace(sectionBody(trimmed, GAPS_HEADING, REQUIRED_SUMMARY_HEADINGS), '')
        .replace(
            sectionBody(trimmed, RISKS_SUBHEADING, [
                ...REQUIRED_SUMMARY_HEADINGS,
                ...REQUIRED_HANDOFF_SUBHEADINGS
            ]),
            ''
        )
        .toLowerCase();

    for (const marker of SPECULATIVE_MARKERS) {
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

export const validateRussianSummary = validateSummary;
