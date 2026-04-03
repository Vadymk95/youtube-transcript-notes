import { describe, expect, it } from 'vitest';

import { runCmd } from './runCmd.js';

describe('runCmd', () => {
    it('runs a valid command and returns stdout', async () => {
        const result = await runCmd(process.execPath, ['-e', 'process.stdout.write("ok")']);

        expect(result.stdout).toBe('ok');
    });

    it('throws a friendly error when the binary is missing', async () => {
        await expect(runCmd('definitely-missing-binary-for-test', [])).rejects.toThrow(
            'Required command not found on PATH: definitely-missing-binary-for-test'
        );
    });

    it('rethrows non-ENOENT exec failures without the PATH wrapper message', async () => {
        await expect(runCmd(process.execPath, ['-e', 'process.exit(7)'])).rejects.toMatchObject({
            code: 7
        });
    });
});
