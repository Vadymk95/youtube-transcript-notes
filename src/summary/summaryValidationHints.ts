/**
 * Human-facing hints after summary contract validation fails (stderr / extended errors).
 */
export type SummaryValidationHintsContext = {
    errors: string[];
    /** Omitted when the active preset cannot be resolved (e.g. invalid `--reply-lang`). */
    replyLanguage?: string | undefined;
    summaryPath: string;
};

function linesForErrors(errors: string[]): string[] {
    const joined = errors.join('\n');
    const out: string[] = [];

    if (
        joined.includes('{{TRANSCRIPT}}') ||
        joined.toLowerCase().includes('transcript placeholder')
    ) {
        out.push(
            'The summary still contains the transcript placeholder: the model must output real sections, not copy the prompt skeleton.'
        );
    }
    if (joined.includes('does not contain') && joined.includes('text')) {
        out.push(
            'Script / language mismatch: the summary text may be the wrong language for this preset. Match `manifest.json` → `replyLanguage`, `--reply-lang` on prepare/complete/check-summary, and how you wrote the summary.'
        );
    }
    if (
        joined.includes('Missing required heading') ||
        joined.includes('Missing required handoff subheading') ||
        joined.includes('numbered list') ||
        joined.includes('bullet points') ||
        joined.includes('too short')
    ) {
        out.push(
            'Structure: compare your markdown to `prompts/video-notes-prompt.md` and the preset in `src/summary/outputLanguage.ts` for this reply language.'
        );
    }
    if (joined.includes('Speculative wording')) {
        out.push(
            'Ambiguity / hedging phrases belong only in the gaps and handoff-risk sections for this preset; rewrite factual parts without those markers.'
        );
    }

    return out;
}

/**
 * Multiline hint block (no trailing newline) for stderr after validation JSON.
 */
export function formatSummaryValidationHints(ctx: SummaryValidationHintsContext): string {
    const extra = linesForErrors(ctx.errors);
    const lang = ctx.replyLanguage;
    const reCheck =
        lang !== undefined
            ? `- Re-check with: npm run agent:check-summary -- "${ctx.summaryPath}" --reply-lang ${lang}`
            : `- Re-check with: npm run agent:check-summary -- "${ctx.summaryPath}" --reply-lang <ru|en>`;
    const preset =
        lang !== undefined
            ? `- Preset in use: ${lang} (must align with prepare and manifest).`
            : `- Fix YT_SUMMARY_LANG or --reply-lang (see stdout JSON), then re-check with the line above.`;
    const parts = ['---', 'Next steps:', reCheck, preset, ...extra.map((l) => `- ${l}`), '---'];
    return parts.join('\n');
}
