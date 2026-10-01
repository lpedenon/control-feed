import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { DEFAULT_SETTINGS, withFeature, withYoutubeFilters } from '../src/core/settings';
import { expect, test } from './support/extension';

/**
 * Runs against the real m.youtube.com, signed out, as an iPhone (Chromium with
 * an iPhone's user agent and screen, not Safari). Screenshots land in
 * .screens/youtube-mobile for a visual check after markup changes.
 */
const YT = 'https://m.youtube.com';
const SEARCH = `${YT}/results?search_query=linear+algebra`;
const SCREENS = join(import.meta.dirname, '..', '.screens', 'youtube-mobile');

test.use({ device: 'iphone' });

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
  await expect(page.locator('ytm-video-with-context-renderer').first()).toBeVisible();
  // Let lazily rendered shelves arrive, as a person scrolling would see them.
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1500);
}

test('search results keep videos and lose every Short', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, SEARCH);
  await waitForResults(page);
  expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBeGreaterThan(3);
  expect(await page.locator('a[href^="/shorts/"]').count()).toBeGreaterThan(0);
  expect(await visibleCount(page, 'a[href^="/shorts/"]')).toBe(0);
  await page.mouse.wheel(0, -4000);
  // The phone site repaints a moment after scrolling; a screenshot taken sooner is blank.
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SCREENS, 'search.png') });
});

test('home shows the quiet message instead of a feed, and the bottom bar has no Shorts', async ({
  page,
  setSettings,
}) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, `${YT}/`);
  await page.waitForTimeout(3000);
  expect(await visibleCount(page, 'ytm-rich-item-renderer')).toBe(0);
  expect(await visibleCount(page, 'ytm-shorts-lockup-view-model')).toBe(0);
  const tabs = await page
    .locator('ytm-pivot-bar-item-renderer')
    .evaluateAll((elements) =>
      elements.filter((e) => e.checkVisibility()).map((e) => e.textContent?.trim() ?? ''),
    );
  expect(tabs.length).toBeGreaterThan(1);
  expect(tabs.join(' ')).not.toContain('Shorts');
  await page.screenshot({ path: join(SCREENS, 'home.png') });
});

test('watch page has no recommendations and still has its video', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, `${YT}/watch?v=fNk_zzaMoSs`);
  await expect(page.locator('video').first()).toBeAttached();
  await expect(
    page.locator('ytm-item-section-renderer[section-identifier="related-items"]').first(),
  ).toBeAttached();
  await page.waitForTimeout(3000);
  expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBe(0);
  await expect(page.locator('ytm-slim-video-metadata-section-renderer')).toBeVisible();
  await page.screenshot({ path: join(SCREENS, 'watch.png') });
});

test('a Shorts link opens in the regular player', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, SEARCH);
  await waitForResults(page);
  const href = await page.locator('a[href^="/shorts/"]').first().getAttribute('href');
  const id = href?.split('/')[2];
  expect(id).toBeTruthy();
  await page.goto(`${YT}/shorts/${id}`, { waitUntil: 'commit' });
  await expect(page).toHaveURL(`${YT}/watch?v=${id}`);
});

test('channel filters apply on a search page', async ({ page, setSettings }) => {
  await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedChannels: ['@3blue1brown'] }));
  await open(page, SEARCH);
  await waitForResults(page);
  expect(await page.locator('a[href="/@3blue1brown"]').count()).toBeGreaterThan(0);
  expect(await visibleCount(page, 'a[href="/@3blue1brown"]')).toBe(0);
  expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBeGreaterThan(3);
});

test('the home feed can be shown again, with Shorts still gone', async ({ page, setSettings }) => {
  await setSettings(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false));
  await open(page, `${YT}/`);
  await page.waitForTimeout(3000);
  expect(await visibleCount(page, 'ytm-shorts-lockup-view-model')).toBe(0);
  await page.screenshot({ path: join(SCREENS, 'home-feed-shown.png') });
});
