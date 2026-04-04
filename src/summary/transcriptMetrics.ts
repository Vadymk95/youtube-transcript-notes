/**
 * Character counts for transcript.md — used in manifest.json so agents can
 * budget model context without reading the full file first.
 */
export type TranscriptCharMetrics = {
    fileChars: number;
    bodyChars: number;
};

const FRONT_MATTER_CLOSE = /\r?\n---\r?\n(\r?\n)?/;

/**
 * If the file starts with YAML front matter (opening `---`), returns body length
 * after the closing `---` line; otherwise both counts equal the full file length.
 */
export function computeTranscriptCharMetrics(markdown: string): TranscriptCharMetrics {
    const fileChars = markdown.length;
    if (!markdown.startsWith('---')) {
        return { fileChars, bodyChars: fileChars };
    }
    const firstNl = markdown.indexOf('\n');
    if (firstNl === -1) {
        return { fileChars, bodyChars: fileChars };
    }
    const rest = markdown.slice(firstNl + 1);
    const closeMatch = FRONT_MATTER_CLOSE.exec(rest);
    if (!closeMatch || closeMatch.index === undefined) {
        return { fileChars, bodyChars: fileChars };
    }
    const bodyStart = firstNl + 1 + closeMatch.index + closeMatch[0].length;
    const bodyChars = Math.max(0, fileChars - bodyStart);
    return { fileChars, bodyChars };
}
