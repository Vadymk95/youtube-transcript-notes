import { describe, expect, it } from 'vitest';

import { parseBatchUrlLines } from '@/cli/batchUrlList';

describe('parseBatchUrlLines', () => {
    it('splits lines and trims', () => {
        expect(parseBatchUrlLines('  https://a.test/x  \nhttps://b.test/y\n')).toEqual([
            'https://a.test/x',
            'https://b.test/y'
        ]);
    });

    it('skips empty lines and hash comments', () => {
        const raw = `# intro
https://a.test/1

# another
https://b.test/2
`;
        expect(parseBatchUrlLines(raw)).toEqual(['https://a.test/1', 'https://b.test/2']);
    });

    it('returns empty array for whitespace-only input', () => {
        expect(parseBatchUrlLines('  \n  \n')).toEqual([]);
    });
});
