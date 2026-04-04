import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prepare = vi.hoisted(() => ({
    prepareAgentWorkflow: vi.fn()
}));

const shell = vi.hoisted(() => ({
    runSummaryShellCommand: vi.fn()
}));

vi.mock('@/summary/agentWorkflow', () => ({
    prepareAgentWorkflow: prepare.prepareAgentWorkflow
}));

vi.mock('@/summary/summaryCommand', async () => {
    const actual = await vi.importActual<typeof import('@/summary/summaryCommand')>(
        '@/summary/summaryCommand'
    );
    return {
        ...actual,
        runSummaryShellCommand: shell.runSummaryShellCommand
    };
});

import { runAgentComplete, SummaryValidationFailedError } from '@/summary/agentCompleteFlow';

describe('runAgentComplete', () => {
    let tmp: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        tmp = await mkdtemp(path.join(os.tmpdir(), 'complete-flow-'));
        prepare.prepareAgentWorkflow.mockResolvedValue({
            artifactDir: path.join(tmp, 'vid'),
            transcriptPath: path.join(tmp, 'vid', 'transcript.md'),
            summaryPromptPath: path.join(tmp, 'vid', 'summary-prompt.md'),
            summaryPath: path.join(tmp, 'vid', 'summary.ru.md'),
            manifestPath: path.join(tmp, 'vid', 'manifest.json'),
            replyLanguage: 'ru',
            videoId: 'vid',
            videoUrl: 'https://example.com',
            videoTitle: 't',
            videoDescription: '',
            transcriptFormat: 'md',
            transcriptSource: 'subtitle-manual',
            generatedAt: new Date().toISOString(),
            transcriptFileChars: 1,
            transcriptBodyChars: 1
        });
    });

    afterEach(async () => {
        await rm(tmp, { recursive: true, force: true });
    });

    it('prepare-only skips summary command', async () => {
        const result = await runAgentComplete({
            workflow: { url: 'https://youtube.com/watch?v=x' },
            prepareOnly: true
        });
        expect(result.stage).toBe('prepare-only');
        expect(shell.runSummaryShellCommand).not.toHaveBeenCalled();
    });

    it('throws when summarize expected but no template', async () => {
        const prev = process.env.YT_SUMMARY_CMD;
        delete process.env.YT_SUMMARY_CMD;
        try {
            await expect(
                runAgentComplete({
                    workflow: { url: 'https://youtube.com/watch?v=x' },
                    prepareOnly: false
                })
            ).rejects.toThrow(/Missing summary command/);
        } finally {
            if (prev !== undefined) {
                process.env.YT_SUMMARY_CMD = prev;
            }
        }
    });

    it('runs command and validates Russian summary', async () => {
        const summaryPath = path.join(tmp, 'vid', 'summary.ru.md');
        const validRu = `## О чем видео
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

        shell.runSummaryShellCommand.mockImplementation(async () => {
            await mkdir(path.dirname(summaryPath), { recursive: true });
            await writeFile(summaryPath, validRu, 'utf8');
        });

        const result = await runAgentComplete({
            workflow: { url: 'https://youtube.com/watch?v=x', replyLanguage: 'ru' },
            summaryCommandTemplate: 'true'
        });

        expect(result.stage).toBe('complete');
        if (result.stage === 'complete') {
            expect(result.validation.valid).toBe(true);
            expect(result.attempts).toBe(1);
        }
        expect(await readFile(summaryPath, 'utf8')).toContain('## О чем видео');
    });

    it('throws SummaryValidationFailedError when summary stays invalid', async () => {
        const summaryPath = path.join(tmp, 'vid', 'summary.ru.md');
        shell.runSummaryShellCommand.mockImplementation(async () => {
            await mkdir(path.dirname(summaryPath), { recursive: true });
            await writeFile(summaryPath, '# broken\n', 'utf8');
        });

        let err: unknown;
        try {
            await runAgentComplete({
                workflow: { url: 'https://youtube.com/watch?v=x', replyLanguage: 'ru' },
                summaryCommandTemplate: 'true',
                maxAttempts: 2
            });
            expect.fail('expected SummaryValidationFailedError');
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(SummaryValidationFailedError);
        expect((err as SummaryValidationFailedError).replyLanguage).toBe('ru');
    });

    it('throws when summary file is empty after summary command', async () => {
        const summaryPath = path.join(tmp, 'vid', 'summary.ru.md');
        shell.runSummaryShellCommand.mockImplementation(async () => {
            await mkdir(path.dirname(summaryPath), { recursive: true });
            await writeFile(summaryPath, '  \n\t\n', 'utf8');
        });

        await expect(
            runAgentComplete({
                workflow: { url: 'https://youtube.com/watch?v=x', replyLanguage: 'ru' },
                summaryCommandTemplate: 'true'
            })
        ).rejects.toThrow(/Summary file is empty/);
    });

    it('retries until validation passes', async () => {
        const summaryPath = path.join(tmp, 'vid', 'summary.ru.md');
        const validRu = `## О чем видео
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
        let calls = 0;
        shell.runSummaryShellCommand.mockImplementation(async () => {
            calls += 1;
            await mkdir(path.dirname(summaryPath), { recursive: true });
            if (calls === 1) {
                await writeFile(summaryPath, '# broken\n', 'utf8');
            } else {
                await writeFile(summaryPath, validRu, 'utf8');
            }
        });

        const result = await runAgentComplete({
            workflow: { url: 'https://youtube.com/watch?v=x', replyLanguage: 'ru' },
            summaryCommandTemplate: 'true',
            maxAttempts: 3
        });

        expect(result.stage).toBe('complete');
        expect(calls).toBe(2);
        if (result.stage === 'complete') {
            expect(result.attempts).toBe(2);
        }
    });
});
