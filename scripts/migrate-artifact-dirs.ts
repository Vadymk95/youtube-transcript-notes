/**
 * One-shot migration: rename artifact directories from `<videoId>/` to `<slug>-<id6>/`.
 * Updates absolute paths inside `manifest.json` and `cursor-handoff.md`.
 *
 * Usage:
 *   npx tsx scripts/migrate-artifact-dirs.ts            # apply changes
 *   npx tsx scripts/migrate-artifact-dirs.ts --dry-run  # log only, no writes
 */
import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildArtifactDirName } from '@/shared/safePathSegment';

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'artifacts', 'videos');
const DRY_RUN = process.argv.includes('--dry-run');

type MigrationManifest = {
    videoTitle: string;
    videoId: string;
    transcriptPath?: string;
    summaryPromptPath?: string;
    summaryPath?: string;
    cursorHandoffPath?: string;
    verificationHintsPath?: string;
    [key: string]: unknown;
};

async function migrateOne(oldDirName: string): Promise<void> {
    const oldDir = path.join(ARTIFACTS_DIR, oldDirName);
    const manifestPath = path.join(oldDir, 'manifest.json');
    try {
        await stat(manifestPath);
    } catch {
        console.warn(`[skip] no manifest.json in ${oldDirName}`);
        return;
    }

    const manifestRaw = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw) as MigrationManifest;
    const newName = buildArtifactDirName(manifest.videoTitle, manifest.videoId);
    if (newName === oldDirName) {
        console.log(`[ok] already in new format: ${oldDirName}`);
        return;
    }

    const newDir = path.join(ARTIFACTS_DIR, newName);
    console.log(`[mv] ${oldDirName} -> ${newName}`);
    if (DRY_RUN) {
        return;
    }

    await rename(oldDir, newDir);

    const updated: MigrationManifest = { ...manifest };
    const pathKeys: (keyof MigrationManifest)[] = [
        'transcriptPath',
        'summaryPromptPath',
        'summaryPath',
        'cursorHandoffPath',
        'verificationHintsPath'
    ];
    for (const key of pathKeys) {
        const value = updated[key];
        if (typeof value === 'string' && value.startsWith(oldDir)) {
            updated[key] = value.replace(oldDir, newDir);
        }
    }
    const newManifestPath = path.join(newDir, 'manifest.json');
    await writeFile(newManifestPath, `${JSON.stringify(updated, null, 4)}\n`, 'utf8');

    const handoffPath = path.join(newDir, 'cursor-handoff.md');
    try {
        const handoff = await readFile(handoffPath, 'utf8');
        const rewritten = handoff.replaceAll(oldDir, newDir);
        if (rewritten !== handoff) {
            await writeFile(handoffPath, rewritten, 'utf8');
        }
    } catch {
        // cursor-handoff.md may not exist on older bundles; skip silently
    }
}

async function main(): Promise<void> {
    const entries = await readdir(ARTIFACTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        await migrateOne(entry.name);
    }
    console.log(DRY_RUN ? '[dry-run] no changes written' : '[done]');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
