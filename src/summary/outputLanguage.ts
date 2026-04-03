export type SummaryOutputLanguageConfig = {
    code: string;
    englishName: string;
    requiredHeadings: readonly [string, string, string, string, string];
    requiredHandoffSubheadings: readonly [string, string, string, string];
    ambiguityFallback: string;
    speculativeMarkers: readonly string[];
    contentScriptRegex: RegExp;
    contentScriptLabel: string;
};

export const SUMMARY_OUTPUT_LANGUAGE = {
    code: 'ru',
    englishName: 'Russian',
    requiredHeadings: [
        '## О чем видео',
        '## Краткий план',
        '## Главные идеи',
        '## Важно для следующего агента',
        '## Пробелы и неоднозначности'
    ],
    requiredHandoffSubheadings: [
        '### Факты, числа, имена',
        '### Термины и определения',
        '### Практические шаги',
        '### Риски и оговорки'
    ],
    ambiguityFallback: 'Не указано в транскрипте',
    speculativeMarkers: ['вероятно', 'скорее всего', 'по-видимому', 'можно предположить', 'похоже'],
    contentScriptRegex: /[А-Яа-яЁёІіЇїЄєҐґ]/,
    contentScriptLabel: 'Cyrillic'
} as const satisfies SummaryOutputLanguageConfig;

export const DEFAULT_REPLY_LANGUAGE = SUMMARY_OUTPUT_LANGUAGE.code;

function headingText(heading: string): string {
    return heading.replace(/^#+\s*/, '');
}

function lineList(lines: readonly string[]): string {
    return lines.join('\n');
}

export function summaryFileName(): string {
    return `summary.${SUMMARY_OUTPUT_LANGUAGE.code}.md`;
}

export function renderPromptRequiredOutputFormat(): string {
    const [topic, outline, ideas, handoff, gaps] = SUMMARY_OUTPUT_LANGUAGE.requiredHeadings;
    const [facts, terms, steps, risks] = SUMMARY_OUTPUT_LANGUAGE.requiredHandoffSubheadings;

    return [
        topic,
        '',
        'Write 1–3 sentences about the topic, implied audience, and context if stated.',
        '',
        outline,
        '',
        'Write a numbered list of **5–12** points in video order.',
        '',
        ideas,
        '',
        'Write a bullet list of **3–7** takeaways.',
        '',
        handoff,
        '',
        'Use these exact subheadings:',
        '',
        facts,
        '',
        'List facts, numbers, names, dates, books, authors, and links explicitly mentioned in the transcript. Do not invent.',
        '',
        terms,
        '',
        'List terms and definitions only if the video gives them.',
        '',
        steps,
        '',
        'List practical recommendations or actions if any.',
        '',
        risks,
        '',
        'List risks, caveats, or controversial points if the speaker raises them.',
        '',
        gaps,
        '',
        'State what is cut off, contradictory, or needs checking against a primary source.'
    ].join('\n');
}

export function promptTemplateVariables(transcript: string): Record<string, string> {
    return {
        TRANSCRIPT: transcript.trimEnd(),
        OUTPUT_LANGUAGE_NAME: SUMMARY_OUTPUT_LANGUAGE.englishName,
        OUTPUT_LANGUAGE_NAME_LOWER: SUMMARY_OUTPUT_LANGUAGE.englishName.toLowerCase(),
        REQUIRED_OUTPUT_FORMAT: renderPromptRequiredOutputFormat(),
        HANDOFF_HEADING_TEXT: headingText(SUMMARY_OUTPUT_LANGUAGE.requiredHeadings[3]),
        AMBIGUITY_FALLBACK: SUMMARY_OUTPUT_LANGUAGE.ambiguityFallback,
        SPECULATIVE_MARKERS: lineList(
            SUMMARY_OUTPUT_LANGUAGE.speculativeMarkers.map((marker) => `\`${marker}\``)
        )
    };
}
