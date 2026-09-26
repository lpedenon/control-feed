import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserContext } from '@playwright/test';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

type Resolver = (url: URL) => string | null;

/** Which captured snapshot answers a YouTube URL. */
const youtubePage: Resolver = (url) => {
  if (url.pathname === '/') return 'youtube/home.html';
  if (url.pathname === '/results') return 'youtube/search.html';
  if (url.pathname === '/watch') return 'youtube/watch.html';
  // No Shorts snapshot is needed: tests only check where a Shorts URL ends up.
  if (url.pathname.startsWith('/shorts/')) return 'youtube/watch.html';
  if (url.pathname.startsWith('/@3blue1brown')) return 'youtube/channel-videos.html';
  return null;
};

/**
 * Answers page loads on the real site's URL with a captured snapshot, so
 * content scripts run exactly as they would there, with no network. Anything
 * else (images, unknown pages) is refused.
 */
export async function serveFixtures(context: BrowserContext): Promise<void> {
  await context.route('https://www.youtube.com/**', async (route) => {
    const request = route.request();
    const file = request.resourceType() === 'document' ? youtubePage(new URL(request.url())) : null;
    if (file === null) {
      await route.abort();
      return;
    }
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: await readFile(join(FIXTURES, file), 'utf8'),
    });
  });
}
