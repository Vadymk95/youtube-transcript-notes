const ALLOWED_HOSTNAMES = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be'
]);

export function isTranscriptAllowAnyUrlFromEnv(): boolean {
    const v = process.env.YT_TRANSCRIPT_ALLOW_ANY_URL?.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Default input policy: only common YouTube watch / short link hosts.
 * Skipped when `allowAnyUrl` is true or `YT_TRANSCRIPT_ALLOW_ANY_URL` is set (see README / troubleshooting).
 */
export function assertYoutubeWatchUrl(url: string, options?: { allowAnyUrl?: boolean }): void {
    if (options?.allowAnyUrl === true || isTranscriptAllowAnyUrlFromEnv()) {
        return;
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('Malformed URL string');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('URL must use http or https');
    }

    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTNAMES.has(host)) {
        throw new Error('URL hostname is not an allowed YouTube host');
    }
}
