import { beforeEach, describe, expect, it, vi } from 'vitest';

const runCmdMock = vi.hoisted(() => vi.fn());

vi.mock('@/shared/runCmd', () => ({
    runCmd: runCmdMock
}));

import { interpolateSummaryCommand, runSummaryShellCommand } from '@/summary/summaryCommand';

describe('interpolateSummaryCommand', () => {
    it('replaces all given placeholders', () => {
        const cmd = interpolateSummaryCommand(
            'cat "{{SUMMARY_PROMPT_PATH}}" > "{{SUMMARY_OUT_PATH}}"',
            {
                SUMMARY_PROMPT_PATH: '/tmp/p',
                SUMMARY_OUT_PATH: '/tmp/o'
            }
        );
        expect(cmd).toBe('cat "/tmp/p" > "/tmp/o"');
    });

    it('throws when a placeholder remains', () => {
        expect(() =>
            interpolateSummaryCommand('echo "{{SUMMARY_PROMPT_PATH}}" "{{UNKNOWN}}"', {
                SUMMARY_PROMPT_PATH: '/a'
            })
        ).toThrow(/Unreplaced summary command placeholder/);
    });
});

describe('runSummaryShellCommand', () => {
    beforeEach(() => {
        runCmdMock.mockClear();
        runCmdMock.mockResolvedValue({ stdout: '', stderr: '' });
    });

    it('runs sh -c with interpolated template and default maxBuffer', async () => {
        await runSummaryShellCommand('echo "{{VIDEO_ID}}"', { VIDEO_ID: 'abc' });
        expect(runCmdMock).toHaveBeenCalledTimes(1);
        const [file, args, opts] = runCmdMock.mock.calls[0] as [
            string,
            string[],
            { maxBuffer?: number }
        ];
        expect(file).toBe('sh');
        expect(args[0]).toBe('-c');
        expect(args[1]).toBe('echo "abc"');
        expect(opts.maxBuffer).toBe(128 * 1024 * 1024);
    });

    it('forwards custom maxBuffer to runCmd', async () => {
        await runSummaryShellCommand('true', { X: 'y' }, { maxBuffer: 8192 });
        const [, , opts] = runCmdMock.mock.calls[0] as [string, string[], { maxBuffer?: number }];
        expect(opts.maxBuffer).toBe(8192);
    });
});
