/**
 * Wraps a value for safe use as a single POSIX `sh` argument inside `sh -c '...'`.
 * Uses single quotes; embedded `'` becomes `'\''`.
 */
export function quoteForPosixShSingle(value: string): string {
    if (/[\0\n\r]/.test(value)) {
        throw new Error('Cannot safely quote value for shell: contains NUL or newline');
    }
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
