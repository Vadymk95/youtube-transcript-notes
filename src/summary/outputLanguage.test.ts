import { afterEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_REPLY_LANGUAGE_CODE,
    SUMMARY_LANGUAGE_PRESETS,
    listSummaryLanguageCodes,
    renderPromptRequiredOutputFormat,
    resolveSummaryOutputLanguage,
    summaryFileName
} from '@/summary/outputLanguage';

describe('resolveSummaryOutputLanguage', () => {
    const prev = process.env.YT_SUMMARY_LANG;

    afterEach(() => {
        if (prev === undefined) {
            delete process.env.YT_SUMMARY_LANG;
        } else {
            process.env.YT_SUMMARY_LANG = prev;
        }
    });

    it('defaults to ru when unset', () => {
        delete process.env.YT_SUMMARY_LANG;
        expect(resolveSummaryOutputLanguage().code).toBe(DEFAULT_REPLY_LANGUAGE_CODE);
    });

    it('reads YT_SUMMARY_LANG', () => {
        process.env.YT_SUMMARY_LANG = 'en';
        expect(resolveSummaryOutputLanguage().code).toBe('en');
    });

    it('override wins over env', () => {
        process.env.YT_SUMMARY_LANG = 'ru';
        expect(resolveSummaryOutputLanguage('en').code).toBe('en');
    });

    it('throws on unknown code', () => {
        expect(() => resolveSummaryOutputLanguage('zz')).toThrow(/Unknown summary language/);
    });

    it('lists presets', () => {
        expect(listSummaryLanguageCodes()).toEqual(['en', 'ru']);
    });

    it('summaryFileName uses preset', () => {
        expect(summaryFileName(SUMMARY_LANGUAGE_PRESETS.en)).toBe('summary.en.md');
    });
});

describe('renderPromptRequiredOutputFormat', () => {
    it('includes every required heading and handoff subheading for each preset', () => {
        for (const preset of Object.values(SUMMARY_LANGUAGE_PRESETS)) {
            const block = renderPromptRequiredOutputFormat(preset);
            for (const heading of preset.requiredHeadings) {
                expect(block).toContain(heading);
            }
            for (const sub of preset.requiredHandoffSubheadings) {
                expect(block).toContain(sub);
            }
        }
    });

    it('embeds BLUF, chronological outline, and hedging rules in the instruction lines', () => {
        const block = renderPromptRequiredOutputFormat(SUMMARY_LANGUAGE_PRESETS.ru);
        expect(block).toContain('BLUF');
        expect(block).toContain('strict chronological (video) order');
        expect(block).toContain('Preset speculative/hedging phrases are **allowed here**');
        expect(block).toContain('[mm:ss]');
    });
});
