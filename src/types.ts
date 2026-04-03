export type TranscriptSegment = {
    startSec: number;
    endSec: number;
    text: string;
};

export type TranscriptMeta = {
    source: 'subtitle-manual' | 'subtitle-auto' | 'whisper';
    language?: string;
    videoId?: string;
    title?: string;
};
