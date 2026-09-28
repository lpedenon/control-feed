import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { DEFAULT_SETTINGS, withFeature, withYoutubeFilters } from '../src/core/settings';
import { HIDDEN_ATTRIBUTE } from '../src/core/stylesheet';
import { expect, test } from './support/extension';

/**
 * Runs against the real youtube.com, signed out. Screenshots land in
 * .screens/youtube for a visual check after markup changes.
 */
const YT = 'https://www.youtube.com';
const SEARCH = `${YT}/results?search_query=linear+algebra`;
const SCREENS = join(import.meta.dirname, '..', '.screens', 'youtube');
/** A link to one Short (the sidebar's plain "/shorts/" entry is the Shorts feed). */
const SHORT_LINK = 'ytd-search a[href^="/shorts/"]:not([href="/shorts/"])';

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#no-brainrot-style[data-settings="stored"]')).toBeAttached();
}

async function visibleCount(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
}

async function waitForResults(page: Page): Promise<void> {
  await expect(page.locator('ytd-video-renderer').first()).toBeVisible();
  // Let lazily rendered shelves arrive, as a person scrolling would see them.
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1500);
}

test('search results keep videos and lose every Short', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, SEARCH);
  await waitForResults(page);
  expect(await visibleCount(page, 'ytd-video-renderer')).toBeGreaterThan(3);
  expect(await page.locator('a[href^="/shorts/"]').count()).toBeGreaterThan(0);
  expect(await visibleCount(page, 'a[href^="/shorts/"]')).toBe(0);
  await page.mouse.wheel(0, -4000);
  await page.screenshot({ path: join(SCREENS, 'search.png') });
});

test('home shows the quiet message instead of a feed', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, `${YT}/`);
  await page.waitForTimeout(3000);
  expect(await visibleCount(page, 'ytd-rich-item-renderer')).toBe(0);
  await page.screenshot({ path: join(SCREENS, 'home.png') });
});

test('watch page has no recommendations', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, `${YT}/watch?v=fNk_zzaMoSs`);
  await expect(page.locator('#movie_player')).toBeVisible();
  await expect(page.locator('ytd-watch-flexy #related').first()).toBeAttached();
  await page.waitForTimeout(3000);
  expect(await visibleCount(page, 'ytd-watch-flexy #related')).toBe(0);
  expect(await visibleCount(page, 'yt-lockup-view-model')).toBe(0);
  await page.screenshot({ path: join(SCREENS, 'watch.png') });
});

test('a Shorts link opens in the regular player', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, SEARCH);
  await waitForResults(page);
  const href = await page.locator(SHORT_LINK).first().getAttribute('href');
  const id = href?.split('/')[2];
  expect(id).toBeTruthy();
  await page.goto(`${YT}/shorts/${id}`, { waitUntil: 'commit' });
  await expect(page).toHaveURL(`${YT}/watch?v=${id}`);
});

test('clicking into a Short inside YouTube also lands in the regular player', async ({
  page,
  setSettings,
}) => {
  // Shorts visible first so the link is real, then switched off mid-page.
  await setSettings(withFeature(DEFAULT_SETTINGS, 'ytShorts', false));
  await open(page, SEARCH);
  await waitForResults(page);
  const link = page.locator(SHORT_LINK).first();
  const id = (await link.getAttribute('href'))?.split('/')[2];
  expect(id).toBeTruthy();
  await setSettings(DEFAULT_SETTINGS);
  await expect(link).toBeHidden();
  // A script click goes through YouTube's own router (in-page navigation).
  await link.evaluate((element) => (element as HTMLElement).click());
  await expect(page).toHaveURL(`${YT}/watch?v=${id}`);
});

test('blocked keywords hide matching results, also after in-app search', async ({
  page,
  setSettings,
}) => {
  await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedKeywords: ['calculus'] }));
  await open(page, SEARCH);
  await waitForResults(page);

  // Search again through YouTube's own search box: no page reload.
  const box = page.locator('input[name="search_query"]');
  await box.fill('calculus');
  await box.press('Enter');
  await expect(page).toHaveURL(/search_query=calculus/);
  await expect(page.locator(`[${HIDDEN_ATTRIBUTE}="blocked-keyword"]`).first()).toBeAttached();
  await page.waitForTimeout(2000);

  const visibleTitles = await page
    .locator('ytd-video-renderer #video-title')
    .evaluateAll((elements) =>
      elements.filter((e) => e.checkVisibility()).map((e) => e.textContent ?? ''),
    );
  for (const title of visibleTitles) expect(title.toLowerCase()).not.toMatch(/\bcalculus\b/);
  await page.screenshot({ path: join(SCREENS, 'search-keyword-filter.png') });
});

test('only allowed channels leaves just those channels', async ({ page, setSettings }) => {
  await setSettings(
    withYoutubeFilters(DEFAULT_SETTINGS, {
      onlyAllowedChannels: true,
      allowedChannels: ['3Blue1Brown'],
    }),
  );
  await open(page, SEARCH);
  await expect(page.locator('ytd-video-renderer').first()).toBeAttached();
  await page.waitForTimeout(3000);
  const channels = await page
    .locator('ytd-video-renderer ytd-channel-name #text')
    .evaluateAll((elements) => [
      ...new Set(elements.filter((e) => e.checkVisibility()).map((e) => e.textContent?.trim())),
    ]);
  expect(channels).toEqual(['3Blue1Brown']);
  await page.screenshot({ path: join(SCREENS, 'search-allowlist.png') });
});
