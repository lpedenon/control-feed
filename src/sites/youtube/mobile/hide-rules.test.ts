import { describe, expect, it } from 'vitest';
import { HIDDEN_ATTRIBUTE, PAGE_ATTRIBUTE } from '../../../core/stylesheet';
import { loadFixture } from '../../../test-support/fixtures';
import { YOUTUBE_HIDE_RULES } from '../hide-rules';
import { PLAYER_END_SCREEN_SELECTORS } from '../shared';
import { YOUTUBE_MOBILE_BASE_CSS, YOUTUBE_MOBILE_HIDE_RULES } from './hide-rules';

function selectorsFor(feature: string): readonly string[] {
  const rule = YOUTUBE_MOBILE_HIDE_RULES.find((candidate) => candidate.feature === feature);
  expect(rule, feature).toBeDefined();
  return rule?.selectors ?? [];
}

/** Everything one feature's rules would hide on a captured page. */
function hiddenBy(doc: Document, feature: string): Element[] {
  return [...new Set(selectorsFor(feature).flatMap((s) => [...doc.querySelectorAll(s)]))];
}

describe('mobile hide rules on the captured phone pages', () => {
  it('hides the home feed only on the home page', () => {
    const home = loadFixture('youtube-mobile', 'home');
    expect(hiddenBy(home, 'ytHomeFeed')).toHaveLength(0);
    home.documentElement.setAttribute(PAGE_ATTRIBUTE, 'home');
    expect(hiddenBy(home, 'ytHomeFeed').map((element) => element.tagName)).toEqual([
      'YTM-RICH-GRID-RENDERER',
    ]);

    // A channel's video grid uses the same elements and must survive.
    const channel = loadFixture('youtube-mobile', 'channel-videos');
    expect(channel.querySelector('ytm-rich-grid-renderer')).not.toBeNull();
    expect(hiddenBy(channel, 'ytHomeFeed')).toHaveLength(0);
    channel.documentElement.setAttribute(PAGE_ATTRIBUTE, 'channel');
    expect(hiddenBy(channel, 'ytHomeFeed')).toHaveLength(0);
  });

  it('removes Shorts shelves, lockups and the Shorts tab from the home page', () => {
    const home = loadFixture('youtube-mobile', 'home');
    const hidden = hiddenBy(home, 'ytShorts');
    const lockups = home.querySelectorAll('ytm-shorts-lockup-view-model');
    expect(lockups.length).toBeGreaterThan(0);
    for (const lockup of lockups) expect(hidden).toContain(lockup);
    // Each Shorts section goes whole; the news shelf and the community post stay.
    const sections = [...home.querySelectorAll('ytm-rich-section-renderer')];
    const shortsSections = sections.filter((s) => s.querySelector('ytm-shorts-lockup-view-model'));
    expect(shortsSections).toHaveLength(2);
    for (const section of shortsSections) expect(hidden).toContain(section);
    for (const section of sections.filter((s) => !shortsSections.includes(s))) {
      expect(hidden).not.toContain(section);
    }
    // The bottom bar loses only Shorts.
    const tabs = [...home.querySelectorAll('ytm-pivot-bar-item-renderer')];
    const gone = tabs.filter((tab) => hidden.includes(tab));
    expect(gone).toHaveLength(1);
    expect(gone[0]?.textContent).toContain('Shorts');
    expect(tabs.length - gone.length).toBe(2);
  });

  it('removes Shorts from search results but keeps every video and playlist', () => {
    const search = loadFixture('youtube-mobile', 'search');
    const hidden = hiddenBy(search, 'ytShorts');
    for (const shelf of search.querySelectorAll('grid-shelf-view-model')) {
      expect(hidden).toContain(shelf);
    }
    for (const kept of search.querySelectorAll(
      'ytm-video-with-context-renderer, ytm-compact-playlist-renderer',
    )) {
      expect(hidden).not.toContain(kept);
    }
  });

  it('removes the Shorts tab on a channel page but not the Videos tab', () => {
    const channel = loadFixture('youtube-mobile', 'channel-videos');
    const hidden = hiddenBy(channel, 'ytShorts');
    const tabs = hidden.filter((element) => element.tagName === 'YT-TAB-SHAPE');
    expect(tabs.map((element) => element.getAttribute('tab-title'))).toEqual(['Shorts']);
    // The bottom bar's Shorts tab is on every page, this one included.
    expect(
      hidden.filter((element) => element.tagName === 'YTM-PIVOT-BAR-ITEM-RENDERER'),
    ).toHaveLength(1);
    expect(hidden).toHaveLength(2);
  });

  it('removes the Explore launcher chip and nothing else in the chip row', () => {
    const home = loadFixture('youtube-mobile', 'home');
    const hidden = hiddenBy(home, 'ytExplore');
    expect(hidden).toHaveLength(1);
    expect(hidden[0]?.getAttribute('chip-style')).toBe('STYLE_EXPLORE_LAUNCHER_CHIP');
  });

  it('removes related videos next to the player but keeps the video details', () => {
    const watch = loadFixture('youtube-mobile', 'watch');
    const hidden = hiddenBy(watch, 'ytRelated');
    const related = watch.querySelector(
      'ytm-item-section-renderer[section-identifier="related-items"]',
    );
    expect(related && hidden).toContain(related);
    for (const video of related?.querySelectorAll('ytm-video-with-context-renderer') ?? []) {
      expect(related?.contains(video)).toBe(true);
    }
    for (const kept of [
      'ytm-slim-video-metadata-section-renderer',
      'ytm-slim-video-action-bar-renderer',
    ]) {
      const element = watch.querySelector(kept) as Element;
      expect(
        hidden.some((h) => h === element || h.contains(element)),
        kept,
      ).toBe(false);
    }
  });

  it('removes the comments entry, and only that item section, in any language', () => {
    const watch = loadFixture('youtube-mobile', 'watch');
    const hidden = hiddenBy(watch, 'ytComments');
    expect(hidden).toHaveLength(1);
    expect(hidden[0]?.querySelector('yt-video-metadata-carousel-view-model')).not.toBeNull();
    expect(hidden[0]?.hasAttribute('section-identifier')).toBe(false);
  });

  it('hides nothing on the watch page that the video needs to play', () => {
    const watch = loadFixture('youtube-mobile', 'watch');
    const everything = YOUTUBE_MOBILE_HIDE_RULES.flatMap((rule) => [...rule.selectors]);
    const hidden = everything.flatMap((selector) => [...watch.querySelectorAll(selector)]);
    for (const needed of [
      'ytm-watch-player-controls',
      'ytm-custom-control',
      'ytm-mobile-topbar-renderer',
    ]) {
      const element = watch.querySelector(needed) as Element;
      expect(
        hidden.some((h) => h === element || h.contains(element)),
        needed,
      ).toBe(false);
    }
  });

  it('keeps the search box and the top bar on every page', () => {
    for (const name of ['home', 'search', 'watch', 'channel-videos']) {
      const doc = loadFixture('youtube-mobile', name);
      doc.documentElement.setAttribute(PAGE_ATTRIBUTE, name === 'home' ? 'home' : 'other');
      const hidden = YOUTUBE_MOBILE_HIDE_RULES.flatMap((rule) =>
        rule.selectors.flatMap((selector) => [...doc.querySelectorAll(selector)]),
      );
      for (const kept of ['ytm-mobile-topbar-renderer', 'yt-searchbox']) {
        const element = doc.querySelector(kept);
        if (!element) continue;
        expect(
          hidden.some((h) => h === element || h.contains(element)),
          `${name}: ${kept}`,
        ).toBe(false);
      }
    }
  });
});

describe('the phone and desktop rules share the player end screen', () => {
  it('lists the same selectors on both', () => {
    const mobile = YOUTUBE_MOBILE_HIDE_RULES.find((rule) => rule.feature === 'ytEndScreen');
    const desktop = YOUTUBE_HIDE_RULES.find((rule) => rule.feature === 'ytEndScreen');
    expect(mobile?.selectors).toEqual(PLAYER_END_SCREEN_SELECTORS);
    expect(desktop?.selectors).toEqual(PLAYER_END_SCREEN_SELECTORS);
  });
});

describe('the mobile stylesheet', () => {
  it('drops a section once every video in it was filtered out', () => {
    const doc = loadFixture('youtube-mobile', 'home');
    const section = [...doc.querySelectorAll('ytm-rich-section-renderer')].find((s) =>
      s.querySelector('ytm-rich-item-renderer'),
    ) as Element;
    const items = [...section.querySelectorAll('ytm-rich-item-renderer')];
    const rule = YOUTUBE_MOBILE_BASE_CSS.split(' { display: none')[0] as string;
    expect(doc.querySelectorAll(rule)).toHaveLength(0);
    for (const item of items) item.setAttribute(HIDDEN_ATTRIBUTE, 'blocked-keyword');
    expect([...doc.querySelectorAll(rule)]).toEqual([section]);
    items[0]?.removeAttribute(HIDDEN_ATTRIBUTE);
    expect(doc.querySelectorAll(rule)).toHaveLength(0);
  });
});
