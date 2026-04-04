import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertSummaryFileWithinArtifactsRoot } from '@/shared/summaryArtifactPathPolicy';

describe('assertSummaryFileWithinArtifactsRoot', () => {
    const root = path.resolve('/project/artifacts/videos');

    it('allows a file inside the root', () => {
        assertSummaryFileWithinArtifactsRoot(path.join(root, 'vid', 'summary.ru.md'), root);
    });

    it('rejects paths outside the root', () => {
        expect(() =>
            assertSummaryFileWithinArtifactsRoot(path.resolve('/etc/passwd'), root)
        ).toThrow('--artifacts-root');
    });

    it('rejects the root path itself', () => {
        expect(() => assertSummaryFileWithinArtifactsRoot(root, root)).toThrow('--artifacts-root');
    });

    it('rejects a file under a sibling directory of the artifacts root', () => {
        const siblingFile = path.resolve('/project/artifacts/other/summary.ru.md');
        expect(() => assertSummaryFileWithinArtifactsRoot(siblingFile, root)).toThrow(
            '--artifacts-root'
        );
    });
});
