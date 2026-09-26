import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { DEFAULT_SETTINGS, withSite } from '../src/core/settings';
import { expect, test } from './support/extension';
import { INSTAGRAM_LOGGED_IN_MARKER } from './support/instagram-profile';

/**
 * Runs against the real instagram.com with a logged-in test session.
 * Run `node e2e/tools/instagram-login.ts` once first. Screenshots land in
 * .screens/instagram for a visual check.
 */
const IG = 'https://www.instagram.com';
const FOLLOWING = `${IG}/?variant=following`;
const SCREENS = join(import.meta.dirname, '..', '.screens', 'instagram');

test.skip(
  !existsSync(INSTAGRAM_LOGGED_IN_MARKER),
  'Needs a logged-in session: node e2e/tools/instagram-login.ts',
);
test.use({ profile: 'instagram' });

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#control-feed-style[data-settings="stored"]')).toBeAttached();
}

async function visibleCount(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
}

test('home opens the Following feed without the Reels link', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, `${IG}/`);
  await expect(page).toHaveURL(FOLLOWING);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('a[href="/"]').first()).toBeAttached();
  await page.waitForTimeout(3000);
  expect(await page.locator('a[href="/reels/"]').count()).toBeGreaterThan(0);
  expect(await visibleCount(page, 'a[href="/reels/"]')).toBe(0);
  // The Search button links to /explore/, which is also the search page: it stays.
  expect(await visibleCount(page, 'a[href="/explore/"]')).toBeGreaterThan(0);
  expect(await visibleCount(page, 'a[href="/explore/people/"]')).toBe(0);
  await page.screenshot({ path: join(SCREENS, 'home.png') });
});

test('the Reels feed and hashtag pages send you back to the feed', async ({
  page,
  setSettings,
}) => {
  await setSettings(DEFAULT_SETTINGS);
  await page.goto(`${IG}/reels/`, { waitUntil: 'commit' });
  await expect(page).toHaveURL(FOLLOWING);
  await page.goto(`${IG}/explore/tags/travel/`, { waitUntil: 'commit' });
  await expect(page).toHaveURL(FOLLOWING);
});

test('with Instagram switched off, everything is back', async ({ page, setSettings }) => {
  await setSettings(withSite(DEFAULT_SETTINGS, 'instagram', false));
  await open(page, `${IG}/`);
  await expect(page).toHaveURL(`${IG}/`);
  await expect(page.locator('a[href="/reels/"]').first()).toBeVisible();
  await page.screenshot({ path: join(SCREENS, 'home-off.png') });
});
