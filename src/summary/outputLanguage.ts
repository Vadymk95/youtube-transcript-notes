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

/** Default when `YT_SUMMARY_LANG` and CLI override are unset. */
export const DEFAULT_REPLY_LANGUAGE_CODE = 'ru';

const RU: SummaryOutputLanguageConfig = {
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
};

const EN: SummaryOutputLanguageConfig = {
    code: 'en',
    englishName: 'English',
    requiredHeadings: [
        '## What the video is about',
        '## Short outline',
        '## Main ideas',
        '## Important for the next agent',
        '## Gaps and ambiguities'
    ],
    requiredHandoffSubheadings: [
        '### Facts, numbers, names',
        '### Terms and definitions',
        '### Practical steps',
        '### Risks and caveats'
    ],
    ambiguityFallback: 'Not stated in the transcript',
    speculativeMarkers: ['probably', 'likely', 'apparently', 'presumably', 'seems', 'perhaps'],
    contentScriptRegex: /[A-Za-z]/,
    contentScriptLabel: 'Latin letters'
};

/** Built-in presets; extend here for new languages. */
export const SUMMARY_LANGUAGE_PRESETS: Readonly<Record<string, SummaryOutputLanguageConfig>> = {
    ru: RU,
    en: EN
};

/**
 * @deprecated Use `SUMMARY_LANGUAGE_PRESETS.ru` or `resolveSummaryOutputLanguage()` for clarity.
 * Retained so existing imports keep referring to the Russian preset object shape.
 */
export const SUMMARY_OUTPUT_LANGUAGE = RU;

const ENV_SUMMARY_LANG = 'YT_SUMMARY_LANG';

export function listSummaryLanguageCodes(): string[] {
    return Object.keys(SUMMARY_LANGUAGE_PRESETS).sort();
}

/**
 * Resolve active output language: `overrideCode` wins, then `YT_SUMMARY_LANG`, then default `ru`.
 */
export function resolveSummaryOutputLanguage(
    overrideCode?: string | undefined
): SummaryOutputLanguageConfig {
    const raw = (
        overrideCode?.trim() ||
        process.env[ENV_SUMMARY_LANG]?.trim() ||
        DEFAULT_REPLY_LANGUAGE_CODE
    ).toLowerCase();
    const preset = SUMMARY_LANGUAGE_PRESETS[raw];
    if (!preset) {
        throw new Error(
            `Unknown summary language "${raw}". Use one of: ${listSummaryLanguageCodes().join(', ')}. Set ${ENV_SUMMARY_LANG} or pass --reply-lang.`
        );
    }
    return preset;
}

/** @deprecated Use `DEFAULT_REPLY_LANGUAGE_CODE` or `resolveSummaryOutputLanguage().code`. */
export const DEFAULT_REPLY_LANGUAGE = DEFAULT_REPLY_LANGUAGE_CODE;

function headingText(heading: string): string {
    return heading.replace(/^#+\s*/, '');
}

function lineList(lines: readonly string[]): string {
    return lines.join('\n');
}

export function summaryFileName(lang?: SummaryOutputLanguageConfig): string {
    const c = lang ?? resolveSummaryOutputLanguage();
    return `summary.${c.code}.md`;
}

export function renderPromptRequiredOutputFormat(lang?: SummaryOutputLanguageConfig): string {
    const cfg = lang ?? resolveSummaryOutputLanguage();
    const [topic, outline, ideas, handoff, gaps] = cfg.requiredHeadings;
    const [facts, terms, steps, risks] = cfg.requiredHandoffSubheadings;

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

export function promptTemplateVariables(
    transcript: string,
    lang?: SummaryOutputLanguageConfig
): Record<string, string> {
    const cfg = lang ?? resolveSummaryOutputLanguage();
    return {
        TRANSCRIPT: transcript.trimEnd(),
        OUTPUT_LANGUAGE_NAME: cfg.englishName,
        OUTPUT_LANGUAGE_NAME_LOWER: cfg.englishName.toLowerCase(),
        REQUIRED_OUTPUT_FORMAT: renderPromptRequiredOutputFormat(cfg),
        HANDOFF_HEADING_TEXT: headingText(cfg.requiredHeadings[3]),
        AMBIGUITY_FALLBACK: cfg.ambiguityFallback,
        SPECULATIVE_MARKERS: lineList(cfg.speculativeMarkers.map((marker) => `\`${marker}\``))
    };
}
