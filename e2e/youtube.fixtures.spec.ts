import type { Page } from '@playwright/test';
import { DEFAULT_SETTINGS, withFeature, withSite, withYoutubeFilters } from '../src/core/settings';
import { HIDDEN_ATTRIBUTE } from '../src/core/stylesheet';
import { expect, test } from './support/extension';
import { serveFixtures } from './support/fixture-server';

const YT = 'https://www.youtube.com';

test.beforeEach(async ({ context }) => {
  await serveFixtures(context);
});

/** Waits until the extension has applied the stored settings to the page. */
async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(`${YT}${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#control-feed-style[data-settings="stored"]')).toBeAttached();
}

async function visibleCount(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
}

test.describe('home', () => {
  test('hides the feed and explains why', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/');
    await expect(
      page.locator('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer'),
    ).toBeHidden();
    const message = await page
      .locator('ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer')
      .evaluate((element) => getComputedStyle(element, '::before').content);
    expect(message).toContain('Your home feed is hidden');
  });

  test('with the feed shown, still removes Shorts shelves', async ({ page, setSettings }) => {
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false));
    await openPage(page, '/');
    expect(await visibleCount(page, 'ytd-rich-item-renderer')).toBeGreaterThan(10);
    expect(await visibleCount(page, 'ytm-shorts-lockup-view-model')).toBe(0);
    expect(await visibleCount(page, 'ytd-rich-shelf-renderer[is-shorts]')).toBe(0);
  });

  test('removes a shelf once every video in it is filtered out', async ({ page, setSettings }) => {
    const settings = withYoutubeFilters(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false), {
      onlyAllowedChannels: true,
      allowedChannels: ['3Blue1Brown'],
    });
    await setSettings(settings);
    await openPage(page, '/');
    expect(await visibleCount(page, 'ytd-rich-section-renderer')).toBe(0);
  });
});

test.describe('search', () => {
  test('removes Shorts but keeps regular results', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/results?search_query=linear+algebra');
    expect(await visibleCount(page, 'ytd-video-renderer')).toBeGreaterThan(5);
    expect(await visibleCount(page, 'grid-shelf-view-model')).toBe(0);
    expect(await visibleCount(page, 'a[href^="/shorts/"]')).toBe(0);
  });

  test('hides results whose title has a blocked keyword', async ({ page, setSettings }) => {
    await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedKeywords: ['essence'] }));
    await openPage(page, '/results?search_query=linear+algebra');
    const hidden = page.locator(`ytd-video-renderer[${HIDDEN_ATTRIBUTE}="blocked-keyword"]`);
    await expect(hidden.first()).toBeAttached();
    for (const title of await hidden.locator('#video-title').allTextContents()) {
      expect(title.toLowerCase()).toContain('essence');
    }
    await expect(hidden.first()).toBeHidden();
    expect(await visibleCount(page, 'ytd-video-renderer')).toBeGreaterThan(3);
  });

  test('hides results from blocked channels', async ({ page, setSettings }) => {
    await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedChannels: ['@3blue1brown'] }));
    await openPage(page, '/results?search_query=linear+algebra');
    await expect(page.locator(`[${HIDDEN_ATTRIBUTE}="blocked-channel"]`).first()).toBeAttached();
    const visibleChannels = await page
      .locator('ytd-video-renderer ytd-channel-name #text')
      .evaluateAll((elements) =>
        elements.filter((e) => e.checkVisibility()).map((e) => e.textContent?.trim()),
      );
    expect(visibleChannels.length).toBeGreaterThan(3);
    expect(visibleChannels).not.toContain('3Blue1Brown');
  });

  test('with only allowed channels on, shows nothing else', async ({ page, setSettings }) => {
    await setSettings(
      withYoutubeFilters(DEFAULT_SETTINGS, {
        onlyAllowedChannels: true,
        allowedChannels: ['3Blue1Brown'],
      }),
    );
    await openPage(page, '/results?search_query=linear+algebra');
    const visibleChannels = await page
      .locator('ytd-video-renderer ytd-channel-name #text')
      .evaluateAll((elements) => [
        ...new Set(elements.filter((e) => e.checkVisibility()).map((e) => e.textContent?.trim())),
      ]);
    expect(visibleChannels).toEqual(['3Blue1Brown']);
  });
});

test.describe('watch page', () => {
  test('hides recommendations and keeps comments by default', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/watch?v=fNk_zzaMoSs');
    await expect(page.locator('ytd-watch-flexy #related').first()).toBeHidden();
    await expect(page.locator('ytd-comments#comments')).toBeVisible();
    await expect(page.locator('.ytp-fullscreen-grid')).toBeHidden();
  });

  test('applies setting changes to open pages immediately', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/watch?v=fNk_zzaMoSs');
    await expect(page.locator('ytd-comments#comments')).toBeVisible();
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytComments', true));
    await expect(page.locator('ytd-comments#comments')).toBeHidden();
  });
});

test.describe('channel page', () => {
  test('filters videos by the channel whose page it is', async ({ page, setSettings }) => {
    await setSettings(
      withYoutubeFilters(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false), {
        onlyAllowedChannels: true,
        allowedChannels: ['3Blue1Brown'],
      }),
    );
    await openPage(page, '/@3blue1brown/videos');
    expect(await visibleCount(page, 'ytd-rich-item-renderer')).toBeGreaterThan(20);

    await setSettings(
      withYoutubeFilters(DEFAULT_SETTINGS, {
        onlyAllowedChannels: true,
        allowedChannels: ['Khan Academy'],
      }),
    );
    await expect.poll(() => visibleCount(page, 'ytd-rich-item-renderer')).toBe(0);
  });
});

test.describe('redirects and switches', () => {
  test('opens a Short in the regular player', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await page.goto(`${YT}/shorts/nIoyae9byFc`, { waitUntil: 'commit' });
    await expect(page).toHaveURL(`${YT}/watch?v=nIoyae9byFc`);
  });

  test('does nothing when YouTube is switched off', async ({ page, setSettings }) => {
    await setSettings(withSite(DEFAULT_SETTINGS, 'youtube', false));
    await openPage(page, '/results?search_query=linear+algebra');
    await expect(page.locator('grid-shelf-view-model').first()).toBeVisible();
    await openPage(page, '/shorts/nIoyae9byFc');
    expect(new URL(page.url()).pathname).toBe('/shorts/nIoyae9byFc');
  });
});
