import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Browser profile holding a logged-in Instagram session (see e2e/tools/instagram-login.ts). */
export const INSTAGRAM_PROFILE_DIR = join(import.meta.dirname, '..', '.auth', 'instagram');

/** Written by the login script once a session exists; the profile folder alone proves nothing. */
export const INSTAGRAM_LOGGED_IN_MARKER = join(INSTAGRAM_PROFILE_DIR, '.logged-in');

/**
 * A throwaway copy of the logged-in profile, so parallel tests never share
 * (or lock) one browser profile. Call the returned cleanup when done.
 */
export async function copyInstagramProfile(): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), 'control-feed-ig-'));
  await cp(INSTAGRAM_PROFILE_DIR, dir, {
    recursive: true,
    // Lock files belong to a running browser and must not be copied.
    filter: (source) => !/Singleton(Lock|Socket|Cookie)$/.test(source),
  });
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
