import { describe, expect, it } from 'vitest';

import { validateSummary } from '@/summary/summaryContract';

describe('validateSummary', () => {
    it('accepts a well-formed Russian summary', () => {
        const summary = `## О чем видео
Это короткое видео, где автор стоит перед слонами в зоопарке и описывает, что у них очень длинные хоботы.

## Краткий план
1. Автор показывает место действия.
2. Указывает на слонов.
3. Отмечает длинные хоботы.
4. Коротко завершает рассказ.

## Главные идеи
- Видео очень короткое и наблюдательное.
- Основной объект внимания — слоны.

## Важно для следующего агента
### Факты, числа, имена
- Упомянуты слоны и зоопарк.

### Термины и определения
- Новых терминов нет.

### Практические шаги
- Практических рекомендаций нет.

### Риски и оговорки
- Транскрипт очень короткий, поэтому выводы ограничены.

## Пробелы и неоднозначности
В тексте нет дополнительного контекста, поэтому многое остается неуточненным.
`;

        expect(validateSummary(summary)).toEqual({
            valid: true,
            errors: []
        });
    });

    it('reports missing structure and missing Cyrillic text', () => {
        const result = validateSummary('## Summary\n1. Hello world');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Summary does not contain Cyrillic text');
        expect(result.errors).toContain('Missing required heading: ## О чем видео');
        expect(result.errors).toContain(
            'Missing required handoff subheading: ### Факты, числа, имена'
        );
    });

    it('rejects speculative wording outside ambiguity and risk sections', () => {
        const summary = `## О чем видео
Это видео, вероятно, показывает автора рядом со слонами.

## Краткий план
1. Автор появляется в кадре.
2. Говорит о слонах.

## Главные идеи
- У слонов длинные хоботы.

## Важно для следующего агента
### Факты, числа, имена
- Упомянуты слоны.

### Термины и определения
- Не указано в транскрипте.

### Практические шаги
- Не указано в транскрипте.

### Риски и оговорки
- Транскрипт короткий.

## Пробелы и неоднозначности
Не указано в транскрипте, почему видео было снято.
`;

        const result = validateSummary(summary);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
            'Speculative wording is only allowed in ambiguity/risk sections: вероятно'
        );
    });

    it('accepts a well-formed English summary when lang is en', () => {
        const summary = `## What the video is about
This is a short video where the author stands near elephants at a zoo and notes that elephants have very long trunks.

## Short outline
1. The author shows the setting.
2. Points out the elephants.
3. Mentions long trunks.
4. Ends briefly.

## Main ideas
- The video is very short and observational.
- The main focus is elephants.

## Important for the next agent
### Facts, numbers, names
- Elephants and a zoo are mentioned.

### Terms and definitions
- No new terms.

### Practical steps
- No practical recommendations.

### Risks and caveats
- The transcript is very short, so conclusions are limited.

## Gaps and ambiguities
There is no extra context in the text, so much remains unspecified.
`;

        expect(validateSummary(summary, 'en')).toEqual({
            valid: true,
            errors: []
        });
    });

    it('rejects speculative English wording outside ambiguity sections for en', () => {
        const summary = `## What the video is about
This video probably shows the author near elephants.

## Short outline
1. The author appears on camera.
2. Talks about elephants.

## Main ideas
- Elephants have long trunks.

## Important for the next agent
### Facts, numbers, names
- Elephants mentioned.

### Terms and definitions
- Not stated in the transcript.

### Practical steps
- Not stated in the transcript.

### Risks and caveats
- Short transcript.

## Gaps and ambiguities
Not stated in the transcript why the video was shot.
`;

        const result = validateSummary(summary, 'en');

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
            'Speculative wording is only allowed in ambiguity/risk sections: probably'
        );
    });

    it('throws when YT_SUMMARY_LANG is invalid and language not passed', () => {
        const prev = process.env.YT_SUMMARY_LANG;
        process.env.YT_SUMMARY_LANG = 'xx';
        try {
            expect(() => validateSummary('# x')).toThrow(/Unknown summary language/);
        } finally {
            if (prev === undefined) {
                delete process.env.YT_SUMMARY_LANG;
            } else {
                process.env.YT_SUMMARY_LANG = prev;
            }
        }
    });
});
