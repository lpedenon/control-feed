/**
 * Saves trimmed snapshots of real YouTube pages to e2e/fixtures/youtube/.
 * Unit tests read them to check tile parsing, and the fixture E2E suite serves
 * them at youtube.com URLs so hiding can be checked without the network.
 *
 * Re-run when YouTube changes its markup:
 *   node e2e/tools/capture-youtube-fixtures.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'youtube');

const WARMUP_URL = 'https://www.youtube.com/watch?v=k7RM-ot2NWY';

const PAGES = [
  { name: 'search', url: 'https://www.youtube.com/results?search_query=linear+algebra' },
  { name: 'watch', url: 'https://www.youtube.com/watch?v=fNk_zzaMoSs' },
  { name: 'home', url: 'https://www.youtube.com/' },
  { name: 'channel-videos', url: 'https://www.youtube.com/@3blue1brown/videos' },
] as const;

/** Runs in the page: strips scripts, styles, media and noise, keeping structure and text. */
function snapshotDocument(): string {
  const doc = document.documentElement.cloneNode(true) as HTMLElement;
  const drop = 'script, style, link, noscript, iframe, video, canvas, template, ytd-miniplayer';
  for (const node of doc.querySelectorAll(drop)) node.remove();
  for (const svg of doc.querySelectorAll('svg')) svg.replaceChildren();
  for (const img of doc.querySelectorAll('img')) {
    img.removeAttribute('src');
    img.removeAttribute('srcset');
  }
  for (const element of doc.querySelectorAll('[style]')) element.removeAttribute('style');
  const walker = document.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) comment.parentNode?.removeChild(comment);
  return `<!doctype html>\n${doc.outerHTML}`;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
  // Load a second batch of lazy content, then return to the top.
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(2000);
  await page.mouse.wheel(0, -2500);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    // Without watch history YouTube leaves the home feed empty, so watch a little first.
    await page.goto(WARMUP_URL);
    await page.waitForTimeout(20_000);
    const watched = await page.evaluate(() => document.querySelector('video')?.currentTime ?? 0);
    process.stdout.write(`warm-up played ${Math.round(watched)}s\n`);
    for (const { name, url } of PAGES) {
      await page.goto(url);
      await settle(page);
      const html = await page.evaluate(snapshotDocument);
      const file = join(OUT_DIR, `${name}.html`);
      await writeFile(file, html);
      process.stdout.write(`saved ${file} (${Math.round(html.length / 1024)} KB)\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`capture failed: ${String(error)}\n`);
  process.exitCode = 1;
});
