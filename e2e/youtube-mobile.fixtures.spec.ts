import type { Page } from '@playwright/test';
import { DEFAULT_SETTINGS, withFeature, withSite, withYoutubeFilters } from '../src/core/settings';
import { HIDDEN_ATTRIBUTE, PAGE_ATTRIBUTE } from '../src/core/stylesheet';
import { expect, test } from './support/extension';
import { serveFixtures } from './support/fixture-server';

/**
 * The phone site (m.youtube.com) as YouTube serves it to an iPhone, replayed
 * from captured pages. This is Chromium with an iPhone's user agent and
 * screen, so it checks the rules against the phone markup and not Safari.
 */
const YT = 'https://m.youtube.com';

test.use({ device: 'iphone' });

test.beforeEach(async ({ context }) => {
  await serveFixtures(context);
});

/** Waits until the extension has applied the stored settings to the page. */
async function openPage(page: Page, path: string): Promise<void> {
  await page.goto(`${YT}${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#no-brainrot-style[data-settings="stored"]')).toBeAttached();
}

async function visibleCount(page: Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .evaluateAll((elements) => elements.filter((element) => element.checkVisibility()).length);
}

async function visibleTexts(page: Page, selector: string): Promise<string[]> {
  return page
    .locator(selector)
    .evaluateAll((elements) =>
      elements.filter((e) => e.checkVisibility()).map((e) => (e.textContent ?? '').trim()),
    );
}

const SEARCH = '/results?search_query=linear+algebra';

test.describe('home', () => {
  test('hides the feed and explains why', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/');
    await expect(page.locator(`html[${PAGE_ATTRIBUTE}="home"]`)).toBeAttached();
    await expect(page.locator('ytm-rich-grid-renderer')).toBeHidden();
    expect(await visibleCount(page, 'ytm-rich-item-renderer')).toBe(0);
    const message = await page
      .locator('ytm-single-column-browse-results-renderer')
      .evaluate((element) => getComputedStyle(element, '::before').content);
    expect(message).toContain('Your home feed is hidden');
  });

  test('leaves the top bar with its search, and the pages behind it, alone', async ({
    page,
    setSettings,
  }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/');
    await expect(page.locator('ytm-mobile-topbar-renderer')).toBeVisible();
    await expect(page.locator('yt-searchbox')).toBeVisible();
    await expect(page.locator('ytm-pivot-bar-renderer')).toBeVisible();
  });

  test('removes only the Shorts tab from the bottom bar', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/');
    const tabs = await visibleTexts(page, 'ytm-pivot-bar-item-renderer');
    expect(tabs).toHaveLength(2);
    expect(tabs.join(' ')).not.toContain('Shorts');
    expect(tabs.join(' ')).toContain('Home');
  });

  test('with the feed shown, still removes Shorts shelves', async ({ page, setSettings }) => {
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false));
    await openPage(page, '/');
    expect(await visibleCount(page, 'ytm-rich-item-renderer')).toBeGreaterThan(10);
    expect(await visibleCount(page, 'ytm-shorts-lockup-view-model')).toBe(0);
    expect(await visibleCount(page, 'grid-shelf-view-model')).toBe(0);
  });

  test('removes the Explore chip and keeps the topic chips', async ({ page, setSettings }) => {
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false));
    await openPage(page, '/');
    await expect(
      page.locator('ytm-chip-cloud-chip-renderer[chip-style="STYLE_EXPLORE_LAUNCHER_CHIP"]'),
    ).toBeHidden();
    expect(
      await visibleCount(page, 'ytm-chip-cloud-chip-renderer[chip-style="STYLE_HOME_FILTER"]'),
    ).toBeGreaterThan(3);
  });

  test('removes a section once every video in it is filtered out', async ({
    page,
    setSettings,
  }) => {
    await setSettings(
      withYoutubeFilters(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false), {
        onlyAllowedChannels: true,
        allowedChannels: ['3Blue1Brown'],
      }),
    );
    await openPage(page, '/');
    expect(await visibleCount(page, 'ytm-rich-item-renderer')).toBe(0);
    await expect(page.locator('ytm-rich-shelf-renderer').first()).toBeHidden();
  });

  test('brings the feed back when the switch is turned off on the open page', async ({
    page,
    setSettings,
  }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/');
    await expect(page.locator('ytm-rich-grid-renderer')).toBeHidden();
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false));
    await expect(page.locator('ytm-rich-grid-renderer')).toBeVisible();
    expect(
      await page
        .locator('ytm-single-column-browse-results-renderer')
        .evaluate((element) => getComputedStyle(element, '::before').content),
    ).toBe('none');
  });
});

test.describe('search', () => {
  test('removes Shorts but keeps regular results and playlists', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, SEARCH);
    expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBeGreaterThan(8);
    expect(await visibleCount(page, 'ytm-compact-playlist-renderer')).toBeGreaterThan(4);
    expect(await visibleCount(page, 'grid-shelf-view-model')).toBe(0);
    expect(await visibleCount(page, 'ytm-shorts-lockup-view-model')).toBe(0);
    expect(await visibleCount(page, 'a[href^="/shorts/"]')).toBe(0);
  });

  test('hides results whose title has a blocked keyword', async ({ page, setSettings }) => {
    await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedKeywords: ['essence'] }));
    await openPage(page, SEARCH);
    const hidden = page.locator(
      `ytm-video-with-context-renderer[${HIDDEN_ATTRIBUTE}="blocked-keyword"]`,
    );
    await expect(hidden.first()).toBeAttached();
    for (const title of await hidden.locator('h3').allTextContents()) {
      expect(title.toLowerCase()).toContain('essence');
    }
    await expect(hidden.first()).toBeHidden();
    expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBeGreaterThan(3);
  });

  test('hides results from blocked channels', async ({ page, setSettings }) => {
    await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedChannels: ['@3blue1brown'] }));
    await openPage(page, SEARCH);
    await expect(page.locator(`[${HIDDEN_ATTRIBUTE}="blocked-channel"]`).first()).toBeAttached();
    expect(await visibleCount(page, 'a[href="/@3blue1brown"]')).toBe(0);
    expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBeGreaterThan(3);
  });

  for (const handle of ['math·studio', 'math%C2%B7studio']) {
    test(`keeps /@${handle} distinct from @math in channel filters`, async ({
      page,
      setSettings,
    }) => {
      await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedKeywords: ['matrices'] }));
      await openPage(page, SEARCH);
      await page.evaluate((href) => {
        const tile = document.createElement('ytm-video-with-context-renderer');
        tile.id = 'handle-regression';
        tile.innerHTML = `<a href="/@${href}">Math Studio</a><h3>Matrices explained</h3>
          <ytm-badge-and-byline-renderer><span dir="auto">Math Studio</span></ytm-badge-and-byline-renderer>`;
        const prefix = document.createElement('ytm-video-with-context-renderer');
        prefix.id = 'prefix-regression';
        prefix.innerHTML = `<a href="/@math">Math</a><h3>Matrices explained</h3>
          <ytm-badge-and-byline-renderer><span dir="auto">Math</span></ytm-badge-and-byline-renderer>`;
        const conflicting = tile.cloneNode(true) as Element;
        conflicting.id = 'conflicting-handle-regression';
        conflicting.querySelector('a')?.setAttribute('href', '/@mathstudio');
        document.querySelector('ytm-item-section-renderer')?.append(tile, prefix, conflicting);
      }, handle);
      const tile = page.locator('#handle-regression');
      await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-keyword');

      await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedChannels: ['@math'] }));
      await expect(tile).toBeVisible();
      await expect(tile).not.toHaveAttribute(HIDDEN_ATTRIBUTE);

      await setSettings(
        withYoutubeFilters(DEFAULT_SETTINGS, {
          allowedChannels: ['@math'],
          blockedKeywords: ['matrices'],
        }),
      );
      await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-keyword');
      await expect(tile).toBeHidden();

      await setSettings(
        withYoutubeFilters(DEFAULT_SETTINGS, {
          allowedChannels: ['@math'],
          topicMode: 'block',
          topics: [{ name: 'Matrices', keywords: ['matrices'] }],
        }),
      );
      await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-topic');

      await setSettings(
        withYoutubeFilters(DEFAULT_SETTINGS, {
          allowedChannels: ['@math'],
          onlyAllowedChannels: true,
        }),
      );
      await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'not-allowed-channel');
      const prefix = page.locator('#prefix-regression');
      await expect(prefix).toBeVisible();

      for (const rule of [
        '@math·studio',
        '@math%C2%B7studio',
        'https://m.youtube.com/@math·studio/videos?view=0#top',
        'https://www.youtube.com/@math%C2%B7studio/videos?view=0#top',
      ]) {
        await setSettings(withYoutubeFilters(DEFAULT_SETTINGS, { blockedChannels: [rule] }));
        await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-channel');
        await expect(tile).toBeHidden();
        await expect(prefix).toBeVisible();
        const conflicting = page.locator('#conflicting-handle-regression');
        await expect(conflicting).toBeVisible();

        await setSettings(
          withYoutubeFilters(DEFAULT_SETTINGS, {
            allowedChannels: [rule],
            blockedKeywords: ['matrices'],
          }),
        );
        await expect(tile).toBeVisible();
        await expect(tile).not.toHaveAttribute(HIDDEN_ATTRIBUTE);
        await expect(prefix).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-keyword');
        await expect(conflicting).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-keyword');

        await setSettings(
          withYoutubeFilters(DEFAULT_SETTINGS, {
            topicMode: 'block',
            topics: [{ name: 'Matrices', keywords: ['matrices'] }],
          }),
        );
        await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-topic');
        await setSettings(
          withYoutubeFilters(DEFAULT_SETTINGS, {
            allowedChannels: [rule],
            topicMode: 'block',
            topics: [{ name: 'Matrices', keywords: ['matrices'] }],
          }),
        );
        await expect(tile).toBeVisible();
        await expect(tile).not.toHaveAttribute(HIDDEN_ATTRIBUTE);
        await expect(prefix).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-topic');
        await expect(conflicting).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-topic');

        await setSettings(
          withYoutubeFilters(DEFAULT_SETTINGS, {
            allowedChannels: ['@math'],
            onlyAllowedChannels: true,
          }),
        );
        await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'not-allowed-channel');
        await expect(prefix).toBeVisible();
        await setSettings(
          withYoutubeFilters(DEFAULT_SETTINGS, {
            allowedChannels: [rule],
            onlyAllowedChannels: true,
          }),
        );
        await expect(tile).toBeVisible();
        await expect(tile).not.toHaveAttribute(HIDDEN_ATTRIBUTE);
        await expect(prefix).toHaveAttribute(HIDDEN_ATTRIBUTE, 'not-allowed-channel');
        await expect(conflicting).toHaveAttribute(HIDDEN_ATTRIBUTE, 'not-allowed-channel');
      }
    });
  }

  for (const [path, tag] of [
    [SEARCH, 'ytm-video-with-context-renderer'],
    [SEARCH, 'ytm-compact-playlist-renderer'],
    ['/watch?v=fNk_zzaMoSs', 'ytm-video-with-context-renderer'],
  ]) {
    test(`preserves middle dots in ${tag} publisher names on ${path}`, async ({
      page,
      setSettings,
    }) => {
      const settings = withFeature(DEFAULT_SETTINGS, 'ytRelated', false);
      await setSettings(settings);
      await openPage(page, path);
      await page
        .locator(tag)
        .first()
        .evaluate((tile) => {
          tile.id = 'byline-regression';
          const heading = tile.querySelector('h3');
          const byline = tile.querySelector('ytm-badge-and-byline-renderer > span[dir]');
          if (!heading || !byline) throw new Error('The fixture tile needs a heading and byline');
          heading.textContent = 'Matrices explained';
          tile.querySelector('a[href^="/@"]')?.setAttribute('href', '/@educator123');
          byline.textContent = tile.matches('ytm-compact-playlist-renderer')
            ? 'Music · Science · Playlist'
            : 'Music · Science';
        });
      const tile = page.locator('#byline-regression');
      await setSettings(withYoutubeFilters(settings, { blockedChannels: ['Music · Science'] }));
      await expect(tile).toHaveAttribute(HIDDEN_ATTRIBUTE, 'blocked-channel');
      await expect(tile).toBeHidden();
      await setSettings(withYoutubeFilters(settings, { blockedChannels: ['Music'] }));
      await expect(tile).toBeVisible();
      for (const filters of [
        { blockedKeywords: ['matrices'] },
        { topicMode: 'block' as const, topics: [{ name: 'Matrices', keywords: ['matrices'] }] },
        { onlyAllowedChannels: true },
      ]) {
        await setSettings(withYoutubeFilters(settings, { ...filters, allowedChannels: ['Music'] }));
        await expect(tile).toBeHidden();
        await setSettings(
          withYoutubeFilters(settings, { ...filters, allowedChannels: ['Music · Science'] }),
        );
        await expect(tile).toBeVisible();
        await expect(tile).not.toHaveAttribute(HIDDEN_ATTRIBUTE);
      }
    });
  }

  test('with only allowed channels on, shows nothing else', async ({ page, setSettings }) => {
    await setSettings(
      withYoutubeFilters(DEFAULT_SETTINGS, {
        onlyAllowedChannels: true,
        allowedChannels: ['3Blue1Brown'],
      }),
    );
    await openPage(page, SEARCH);
    const channels = await page
      .locator(
        'ytm-video-with-context-renderer ytm-badge-and-byline-renderer > span[dir]:first-child',
      )
      .evaluateAll((elements) => [
        ...new Set(elements.filter((e) => e.checkVisibility()).map((e) => e.textContent?.trim())),
      ]);
    expect(channels).toEqual(['3Blue1Brown']);
  });

  test('hides results about a blocked topic and shows only chosen topics', async ({
    page,
    setSettings,
  }) => {
    const series = { name: 'Essence series', keywords: ['essence'] };
    await setSettings(
      withYoutubeFilters(DEFAULT_SETTINGS, { topicMode: 'block', topics: [series] }),
    );
    await openPage(page, SEARCH);
    await expect(
      page.locator(`ytm-video-with-context-renderer[${HIDDEN_ATTRIBUTE}="blocked-topic"]`).first(),
    ).toBeHidden();
    for (const title of await visibleTexts(page, 'ytm-video-with-context-renderer h3')) {
      expect(title.toLowerCase()).not.toContain('essence');
    }

    await setSettings(
      withYoutubeFilters(DEFAULT_SETTINGS, { topicMode: 'only', topics: [series] }),
    );
    await expect
      .poll(async () => (await visibleTexts(page, 'ytm-video-with-context-renderer h3')).length)
      .toBeGreaterThan(0);
    for (const title of await visibleTexts(page, 'ytm-video-with-context-renderer h3')) {
      expect(title.toLowerCase()).toContain('essence');
    }
  });
});

test.describe('watch page', () => {
  test('hides related videos and keeps the video details and the comments entry', async ({
    page,
    setSettings,
  }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/watch?v=fNk_zzaMoSs');
    await expect(
      page.locator('ytm-item-section-renderer[section-identifier="related-items"]'),
    ).toBeHidden();
    expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBe(0);
    await expect(page.locator('ytm-slim-video-metadata-section-renderer')).toBeVisible();
    await expect(page.locator('yt-video-metadata-carousel-view-model')).toBeVisible();
    await expect(page.locator('ytm-watch-player-controls')).toBeAttached();
  });

  test('hides the comments entry once that switch is on, on the open page', async ({
    page,
    setSettings,
  }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/watch?v=fNk_zzaMoSs');
    await expect(page.locator('yt-video-metadata-carousel-view-model')).toBeVisible();
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytComments', true));
    await expect(page.locator('yt-video-metadata-carousel-view-model')).toBeHidden();
    await expect(page.locator('ytm-slim-video-metadata-section-renderer')).toBeVisible();
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytComments', false));
    await expect(page.locator('yt-video-metadata-carousel-view-model')).toBeVisible();
  });

  test('shows related videos again when that switch is turned off', async ({
    page,
    setSettings,
  }) => {
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytRelated', false));
    await openPage(page, '/watch?v=fNk_zzaMoSs');
    expect(await visibleCount(page, 'ytm-video-with-context-renderer')).toBeGreaterThan(5);
  });
});

test.describe('channel page', () => {
  test('keeps the video grid, which the home-feed rule must not touch', async ({
    page,
    setSettings,
  }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/@3blue1brown/videos');
    await expect(page.locator(`html[${PAGE_ATTRIBUTE}]`)).toHaveCount(0);
    expect(await visibleCount(page, 'ytm-rich-item-renderer')).toBeGreaterThan(20);
  });

  test('removes the Shorts tab and keeps the Videos tab', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, '/@3blue1brown/videos');
    const tabs = await visibleTexts(page, 'yt-tab-shape');
    expect(tabs).toContain('Videos');
    expect(tabs).not.toContain('Shorts');
  });

  test('filters videos by the channel whose page it is', async ({ page, setSettings }) => {
    await setSettings(
      withYoutubeFilters(DEFAULT_SETTINGS, {
        onlyAllowedChannels: true,
        allowedChannels: ['3Blue1Brown'],
      }),
    );
    await openPage(page, '/@3blue1brown/videos');
    expect(await visibleCount(page, 'ytm-rich-item-renderer')).toBeGreaterThan(20);

    await setSettings(
      withYoutubeFilters(DEFAULT_SETTINGS, {
        onlyAllowedChannels: true,
        allowedChannels: ['Khan Academy'],
      }),
    );
    await expect.poll(() => visibleCount(page, 'ytm-rich-item-renderer')).toBe(0);
  });
});

test.describe('navigating inside the app', () => {
  test('follows a move from search to home and back without a reload', async ({
    page,
    setSettings,
  }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, SEARCH);
    await expect(page.locator(`html[${PAGE_ATTRIBUTE}]`)).toHaveCount(0);

    await page.evaluate(() => history.pushState({}, '', '/'));
    await expect(page.locator(`html[${PAGE_ATTRIBUTE}="home"]`)).toBeAttached();

    await page.evaluate(() => history.pushState({}, '', '/results?search_query=linear+algebra'));
    await expect(page.locator(`html[${PAGE_ATTRIBUTE}]`)).toHaveCount(0);
  });
});

test.describe('redirects and switches', () => {
  test('opens a Short in the regular player', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await page.goto(`${YT}/shorts/nIoyae9byFc`, { waitUntil: 'commit' });
    await expect(page).toHaveURL(`${YT}/watch?v=nIoyae9byFc`);
  });

  test('updates Shorts visibility when its switch changes', async ({ page, setSettings }) => {
    await setSettings(DEFAULT_SETTINGS);
    await openPage(page, SEARCH);
    const shelf = page.locator('grid-shelf-view-model').first();
    await expect(shelf).toBeHidden();
    await setSettings(withFeature(DEFAULT_SETTINGS, 'ytShorts', false));
    await expect(shelf).toBeVisible();
    await expect(page.locator('ytm-pivot-bar-item-renderer').nth(1)).toBeVisible();
    await setSettings(DEFAULT_SETTINGS);
    await expect(shelf).toBeHidden();
  });

  test('does nothing when YouTube is switched off', async ({ page, setSettings }) => {
    await setSettings(withSite(DEFAULT_SETTINGS, 'youtube', false));
    await openPage(page, SEARCH);
    await expect(page.locator('grid-shelf-view-model').first()).toBeVisible();
    await expect(page.locator('ytm-pivot-bar-item-renderer').nth(1)).toBeVisible();
    await openPage(page, '/');
    await expect(page.locator('ytm-rich-grid-renderer')).toBeVisible();
    expect(
      await page
        .locator('ytm-single-column-browse-results-renderer')
        .evaluate((element) => getComputedStyle(element, '::before').content),
    ).toBe('none');
    await openPage(page, '/shorts/nIoyae9byFc');
    expect(new URL(page.url()).pathname).toBe('/shorts/nIoyae9byFc');
  });
});
