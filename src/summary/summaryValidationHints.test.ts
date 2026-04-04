import { describe, expect, it } from 'vitest';

import { formatSummaryValidationHints } from '@/summary/summaryValidationHints';

describe('formatSummaryValidationHints', () => {
    it('includes check-summary command and preset', () => {
        const text = formatSummaryValidationHints({
            errors: ['Missing required heading: ## Foo'],
            replyLanguage: 'ru',
            summaryPath: '/tmp/artifacts/videos/vid/summary.ru.md'
        });
        expect(text).toContain('npm run agent:check-summary');
        expect(text).toContain('summary.ru.md');
        expect(text).toContain('ru');
        expect(text).toContain('video-notes-prompt.md');
    });

    it('adds placeholder hint when transcript placeholder error present', () => {
        const text = formatSummaryValidationHints({
            errors: ['Summary still contains the transcript placeholder'],
            replyLanguage: 'en',
            summaryPath: '/x/summary.en.md'
        });
        expect(text.toLowerCase()).toContain('placeholder');
    });

    it('omits concrete preset when replyLanguage is unresolved', () => {
        const text = formatSummaryValidationHints({
            errors: ['Unknown summary language "xx". Use one of: en, ru.'],
            summaryPath: '/tmp/s.md'
        });
        expect(text).toContain('--reply-lang <ru|en>');
        expect(text).toContain('Fix YT_SUMMARY_LANG');
        expect(text).not.toMatch(/Preset in use: xx/);
    });
});
