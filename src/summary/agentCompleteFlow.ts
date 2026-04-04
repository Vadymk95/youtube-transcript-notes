import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
    prepareAgentWorkflow,
    type AgentWorkflowOptions,
    type AgentWorkflowResult
} from '@/summary/agentWorkflow';
import { runSummaryShellCommand } from '@/summary/summaryCommand';
import { validateSummary, type SummaryValidationResult } from '@/summary/summaryContract';

/** Thrown when all summary attempts fail contract validation. */
export class SummaryValidationFailedError extends Error {
    readonly validation: SummaryValidationResult;
    readonly summaryPath: string;
    readonly attempts: number;
    readonly replyLanguage: string;

    constructor(
        message: string,
        validation: SummaryValidationResult,
        summaryPath: string,
        attempts: number,
        replyLanguage: string
    ) {
        super(message);
        this.name = 'SummaryValidationFailedError';
        this.validation = validation;
        this.summaryPath = summaryPath;
        this.attempts = attempts;
        this.replyLanguage = replyLanguage;
    }
}

export type AgentCompleteOptions = {
    workflow: AgentWorkflowOptions;
    /** Skip summary command; only run prepare (CI / agents without a model). */
    prepareOnly?: boolean;
    /** Shell template; falls back to `YT_SUMMARY_CMD` when omitted (unless prepareOnly). */
    summaryCommandTemplate?: string;
    /** Run summary command up to N times until validation passes (default 1). */
    maxAttempts?: number;
};

export type AgentCompletePrepareOnlyResult = {
    stage: 'prepare-only';
    workflow: AgentWorkflowResult;
};

export type AgentCompleteFullResult = {
    stage: 'complete';
    workflow: AgentWorkflowResult;
    validation: SummaryValidationResult;
    attempts: number;
};

export type AgentCompleteResult = AgentCompletePrepareOnlyResult | AgentCompleteFullResult;

const ENV_SUMMARY_CMD = 'YT_SUMMARY_CMD';

function resolveTemplate(explicit: string | undefined, prepareOnly: boolean): string | undefined {
    if (prepareOnly) {
        return undefined;
    }
    const fromEnv = process.env[ENV_SUMMARY_CMD]?.trim();
    return explicit?.trim() || fromEnv || undefined;
}

function buildCommandVars(result: AgentWorkflowResult): Record<string, string> {
    return {
        SUMMARY_PROMPT_PATH: path.resolve(result.summaryPromptPath),
        SUMMARY_OUT_PATH: path.resolve(result.summaryPath),
        TRANSCRIPT_PATH: path.resolve(result.transcriptPath),
        VIDEO_ID: result.videoId,
        MANIFEST_PATH: path.resolve(result.manifestPath),
        ARTIFACT_DIR: path.resolve(result.artifactDir)
    };
}

export async function runAgentComplete(
    options: AgentCompleteOptions
): Promise<AgentCompleteResult> {
    const prepareOnly = options.prepareOnly ?? false;
    const template = resolveTemplate(options.summaryCommandTemplate, prepareOnly);
    const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 1, 10));

    const workflow = await prepareAgentWorkflow(options.workflow);

    if (prepareOnly) {
        return { stage: 'prepare-only', workflow };
    }

    if (!template) {
        throw new Error(
            [
                `Missing summary command. Set ${ENV_SUMMARY_CMD} or pass --summary-cmd, or use --prepare-only.`,
                '',
                'Example (your local CLI will differ):',
                `  export ${ENV_SUMMARY_CMD}='cat "{{SUMMARY_PROMPT_PATH}}" | llm-bin > "{{SUMMARY_OUT_PATH}}"'`,
                '',
                'Placeholders {{SUMMARY_PROMPT_PATH}} and {{SUMMARY_OUT_PATH}} are replaced with absolute paths; the shell must write the final markdown to SUMMARY_OUT_PATH.'
            ].join('\n')
        );
    }

    const vars = buildCommandVars(workflow);
    let lastValidation: SummaryValidationResult | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        await runSummaryShellCommand(template, vars);
        const content = await readFile(workflow.summaryPath, 'utf8');
        if (!content.trim()) {
            throw new Error(
                `Summary file is empty after summary command (attempt ${attempt}/${maxAttempts}): ${workflow.summaryPath}`
            );
        }
        lastValidation = validateSummary(content, workflow.replyLanguage);
        if (lastValidation.valid) {
            return {
                stage: 'complete',
                workflow,
                validation: lastValidation,
                attempts: attempt
            };
        }
    }

    if (!lastValidation) {
        throw new Error('Validation loop exited without result');
    }
    throw new SummaryValidationFailedError(
        `Summary validation failed after ${maxAttempts} attempt(s). Fix your ${ENV_SUMMARY_CMD} or edit ${workflow.summaryPath} manually, then run agent:check-summary.`,
        lastValidation,
        workflow.summaryPath,
        maxAttempts,
        workflow.replyLanguage
    );
}
