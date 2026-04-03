export const DEFAULT_REPLY_LANGUAGE = 'ru' as const;

export const REQUIRED_SUMMARY_HEADINGS = [
    '## О чем видео',
    '## Краткий план',
    '## Главные идеи',
    '## Важно для следующего агента',
    '## Пробелы и неоднозначности'
] as const;

const REQUIRED_HANDOFF_SUBHEADINGS = [
    '### Факты, числа, имена',
    '### Термины и определения',
    '### Практические шаги',
    '### Риски и оговорки'
] as const;

const SPECULATIVE_MARKERS = [
    'вероятно',
    'скорее всего',
    'по-видимому',
    'можно предположить',
    'похоже'
] as const;

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

function hasCyrillicText(content: string): boolean {
    return /[А-Яа-яЁёІіЇїЄєҐґ]/.test(content);
}

export function validateRussianSummary(content: string): SummaryValidationResult {
    const errors: string[] = [];
    const trimmed = content.trim();

    if (trimmed.length === 0) {
        errors.push('Summary file is empty');
        return { valid: false, errors };
    }

    if (trimmed.includes('{{TRANSCRIPT}}')) {
        errors.push('Summary still contains the transcript placeholder');
    }

    if (!hasCyrillicText(trimmed)) {
        errors.push('Summary does not contain Cyrillic text');
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

    const outlineBody = sectionBody(trimmed, '## Краткий план', REQUIRED_SUMMARY_HEADINGS);
    if (!/\n?1\.\s+/m.test(outlineBody)) {
        errors.push('Short outline must contain a numbered list');
    }

    const ideasBody = sectionBody(trimmed, '## Главные идеи', REQUIRED_SUMMARY_HEADINGS);
    if (!/^\s*-\s+/m.test(ideasBody)) {
        errors.push('Main ideas must contain bullet points');
    }

    const topicBody = sectionBody(trimmed, '## О чем видео', REQUIRED_SUMMARY_HEADINGS);
    if (topicBody.length < 20) {
        errors.push('The video topic section is too short');
    }

    const gapsBody = sectionBody(
        trimmed,
        '## Пробелы и неоднозначности',
        REQUIRED_SUMMARY_HEADINGS
    ).toLowerCase();
    const risksBody = sectionBody(trimmed, '### Риски и оговорки', [
        ...REQUIRED_SUMMARY_HEADINGS,
        ...REQUIRED_HANDOFF_SUBHEADINGS
    ]).toLowerCase();
    const groundedBody = trimmed
        .replace(
            sectionBody(trimmed, '## Пробелы и неоднозначности', REQUIRED_SUMMARY_HEADINGS),
            ''
        )
        .replace(
            sectionBody(trimmed, '### Риски и оговорки', [
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
