import { describe, expect, it } from 'vitest';

import { quoteForPosixShSingle } from '@/shared/posixShellQuote';

describe('quoteForPosixShSingle', () => {
    it('wraps plain values in single quotes', () => {
        expect(quoteForPosixShSingle('hello')).toBe(`'hello'`);
    });

    it('escapes embedded single quotes', () => {
        expect(quoteForPosixShSingle(`a'b`)).toBe(`'a'\\''b'`);
    });

    it('throws when value contains NUL', () => {
        expect(() => quoteForPosixShSingle('a\0b')).toThrow(/NUL or newline/);
    });

    it('throws when value contains newline or carriage return', () => {
        expect(() => quoteForPosixShSingle('a\nb')).toThrow(/NUL or newline/);
        expect(() => quoteForPosixShSingle('a\rb')).toThrow(/NUL or newline/);
    });
});
