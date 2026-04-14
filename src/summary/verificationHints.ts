import type { TranscriptSegment } from '@/transcript/types';

const URL_IN_TEXT = /https?:\/\/[^\s<>"'{}|\\^`[\]()]+/gi;

/**
 * Collects http(s) URLs from YouTube page description (rough extraction).
 */
export function extractHttpUrls(description: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(URL_IN_TEXT);
    while ((m = re.exec(description)) !== null) {
        const u = m[0].replace(/[),.;]+$/g, '');
        if (!seen.has(u)) {
            seen.add(u);
            out.push(u);
        }
    }
    return out;
}

function formatTimestamp(sec: number): string {
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

export type VerificationHintsInput = {
    videoUrl: string;
    pageDescription: string;
    /** Sample of segment starts for “check at this time” cues. */
    segments: readonly TranscriptSegment[];
    maxAnchors: number;
};

/**
 * Machine-oriented markdown for fact-checking (no network I/O). English section titles for stable tooling.
 */
export function buildVerificationHintsMarkdown(input: VerificationHintsInput): string {
    const urls = extractHttpUrls(input.pageDescription);
    const sortedSeg = input.segments.slice().sort((a, b) => a.startSec - b.startSec);
    const anchors: TranscriptSegment[] = [];
    let lastStart = -Infinity;
    for (const s of sortedSeg) {
        if (anchors.length === 0 || s.startSec - lastStart >= 30) {
            anchors.push(s);
            lastStart = s.startSec;
            if (anchors.length >= input.maxAnchors) {
                break;
            }
        }
    }

    const lines: string[] = [
        '# Verification hints (pipeline-generated)',
        '',
        'This file lists **URLs from the page description** and **sample transcript timestamps** for manual or downstream fact-checking. It does **not** fetch the network.',
        '',
        '## Page links (from description)',
        ''
    ];

    if (urls.length === 0) {
        lines.push('- _(no http(s) URLs detected)_');
    } else {
        for (const u of urls) {
            lines.push(`- ${u}`);
        }
    }

    lines.push('', '## Transcript time anchors (sample)', '', `- Video URL: ${input.videoUrl}`);

    if (anchors.length === 0) {
        lines.push('- _(no segments)_');
    } else {
        for (const s of anchors) {
            const snippet = s.text.replace(/\s+/g, ' ').trim().slice(0, 120);
            lines.push(
                `- **${formatTimestamp(s.startSec)}** — ${snippet}${s.text.length > 120 ? '…' : ''}`
            );
        }
    }

    lines.push(
        '',
        '## Notes',
        '',
        '- Claims in the summary must still be grounded in `transcript.md`; treat description links as **pointers**, not proof.',
        ''
    );

    return lines.join('\n');
}
