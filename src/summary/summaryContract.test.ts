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
});
