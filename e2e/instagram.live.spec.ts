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
const POST_LINKS = 'main a[href^="/p/"], main a[href*="/reel/"]';
const SEARCH_INPUT = 'input[aria-label="Search input"]';

test.skip(
  !existsSync(INSTAGRAM_LOGGED_IN_MARKER),
  'Needs a logged-in session: node e2e/tools/instagram-login.ts',
);
test.use({ profile: 'instagram' });

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#no-brainrot-style[data-settings="stored"]')).toBeAttached();
}

/** Instagram greets new browser profiles with prompts such as "Turn on Notifications". */
async function dismissPrompts(page: Page): Promise<void> {
  const notNow = page.getByRole('button', { name: 'Not Now' });
  if (await notNow.isVisible()) await notNow.click();
}

async function visibleCount(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
}

test('home is the Following feed, without Reels or suggested accounts', async ({
  page,
  setSettings,
}) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, `${IG}/`);
  await expect(page).toHaveURL(FOLLOWING);
  await expect(page.locator('main article').first()).toBeVisible();
  await page.waitForTimeout(3000);
  await dismissPrompts(page);

  expect(await page.locator('a[href="/reels/"]').count()).toBeGreaterThan(0);
  expect(await visibleCount(page, 'a[href="/reels/"]')).toBe(0);
  // The Search button links to /explore/, which is also the search page: it stays.
  expect(await visibleCount(page, 'a[href="/explore/"]')).toBeGreaterThan(0);
  expect(await visibleCount(page, 'a[href="/explore/people/"]')).toBe(0);
  expect(
    await page
      .getByText('Suggested for you', { exact: true })
      .evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length),
  ).toBe(0);
  await page.screenshot({ path: join(SCREENS, 'home.png') });
});

test('the Search page keeps search but drops the recommendation grid', async ({
  page,
  setSettings,
}) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, `${IG}/explore/`);
  await expect(page.locator(SEARCH_INPUT)).toBeVisible();
  await page.waitForTimeout(3000);
  await dismissPrompts(page);
  expect(await page.locator(POST_LINKS).count()).toBeGreaterThan(0);
  expect(await visibleCount(page, POST_LINKS)).toBe(0);
  await page.screenshot({ path: join(SCREENS, 'search-page.png') });

  await page.locator(SEARCH_INPUT).fill('natgeo');
  await expect(page.locator('a[href="/natgeo/"]').first()).toBeVisible();
  await page.screenshot({ path: join(SCREENS, 'search-results.png') });
});

test('clicking around inside Instagram keeps the rules applied', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await open(page, FOLLOWING);
  await expect(page.locator('main article').first()).toBeVisible();
  await dismissPrompts(page);

  // Search, without a page reload.
  await page.locator('a[href="/explore/"]').first().click();
  await expect(page).toHaveURL(`${IG}/explore/`);
  await expect(page.locator(SEARCH_INPUT)).toBeVisible();
  await page.waitForTimeout(3000);
  expect(await visibleCount(page, POST_LINKS)).toBe(0);

  // Home, which Instagram opens on its suggested feed.
  await page
    .locator('a[href="/"]')
    .filter({ has: page.locator('svg') })
    .last()
    .click();
  await expect(page).toHaveURL(FOLLOWING);
});

test('the Reels feed and place pages send you back to the feed', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
  await page.goto(`${IG}/reels/`, { waitUntil: 'commit' });
  await expect(page).toHaveURL(FOLLOWING);
  await page.goto(`${IG}/explore/locations/110585945628334/bangkok-thailand/`, {
    waitUntil: 'commit',
  });
  await expect(page).toHaveURL(FOLLOWING);
});

// Known gap: https://github.com/lpedenon/control-feed/issues/2
// Instagram now answers hashtag pages with a keyword search page
// (/explore/search/keyword/?q=%23travel), a full grid of posts that the
// extension leaves alone because it is a search page.
test.fixme('hashtag pages send you back to the feed', async ({ page, setSettings }) => {
  await setSettings(DEFAULT_SETTINGS);
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
