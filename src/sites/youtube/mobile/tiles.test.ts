import { describe, expect, it } from 'vitest';
import type { YoutubeFilters } from '../../../core/settings';
import { loadFixture } from '../../../test-support/fixtures';
import { createYoutubeDecider } from '../tile-policy';
import { pageChannel } from '../tiles';
import {
  describeMobileTile,
  MOBILE_TILE_SELECTOR,
  resolveMobileTile,
  youtubeMobileTileSource,
} from './tiles';

function tilesIn(doc: Document): Element[] {
  const tiles = [...doc.querySelectorAll(MOBILE_TILE_SELECTOR)].map(resolveMobileTile);
  return [...new Set(tiles.filter((tile) => tile !== null))] as Element[];
}

const NO_FILTERS: YoutubeFilters = {
  blockedKeywords: [],
  blockedChannels: [],
  allowedChannels: [],
  onlyAllowedChannels: false,
  topicMode: 'off',
  topics: [],
};

const withFilters = (patch: Partial<YoutubeFilters>) => ({ ...NO_FILTERS, ...patch });

describe('resolveMobileTile', () => {
  it('returns the outermost tile for anything inside it', () => {
    const home = loadFixture('youtube-mobile', 'home');
    const item = home.querySelector('ytm-rich-item-renderer');
    expect(item?.querySelector('yt-lockup-view-model')).not.toBeNull();
    expect(
      item?.querySelector('h3') && resolveMobileTile(item.querySelector('h3') as Element),
    ).toBe(item);

    const search = loadFixture('youtube-mobile', 'search');
    const video = search.querySelector('ytm-video-with-context-renderer');
    const title = video?.querySelector('h3');
    expect(title && resolveMobileTile(title)).toBe(video);
  });

  it('returns null outside of tiles', () => {
    const doc = loadFixture('youtube-mobile', 'home');
    for (const selector of ['ytm-pivot-bar-renderer', 'ytm-mobile-topbar-renderer', 'ytm-app']) {
      const element = doc.querySelector(selector);
      expect(element, selector).not.toBeNull();
      expect(element && resolveMobileTile(element), selector).toBeNull();
    }
  });
});

describe('describeMobileTile on search results', () => {
  const doc = loadFixture('youtube-mobile', 'search');

  it('reads title, channel name and handle of every video and playlist result', () => {
    const results = [...doc.querySelectorAll('ytm-video-with-context-renderer')];
    const playlists = [...doc.querySelectorAll('ytm-compact-playlist-renderer')];
    expect(results.length).toBeGreaterThan(10);
    expect(playlists.length).toBeGreaterThan(5);
    for (const result of [...results, ...playlists]) {
      const info = describeMobileTile(result, null);
      expect(info?.title).toBeTruthy();
      expect(info?.channel.name).toBeTruthy();
      expect(info?.channel.handle).toMatch(/^[\w.-]+$/);
    }
  });

  it('reads a known result exactly', () => {
    const result = [...doc.querySelectorAll('ytm-video-with-context-renderer')].find((element) =>
      element.querySelector('a[href="/@3blue1brown"]'),
    );
    const info = result && describeMobileTile(result, null);
    expect(info?.channel).toEqual({ name: '3Blue1Brown', handle: '3blue1brown', id: null });
    expect(info?.title).toBe('Vectors | Chapter 1, Essence of linear algebra');
  });

  it('never takes the accessibility label, which repeats the channel and view count', () => {
    for (const tile of tilesIn(doc)) {
      const title = describeMobileTile(tile, null)?.title ?? '';
      expect(title).not.toMatch(/ by .* views?/i);
    }
  });

  it('reads the channel of a playlist without the "· Playlist" suffix', () => {
    const playlist = doc.querySelector('ytm-compact-playlist-renderer');
    const info = playlist && describeMobileTile(playlist, null);
    expect(info?.channel.name).toBe('3Blue1Brown');
    expect(info?.channel.name).not.toContain('·');
  });

  it('reads Shorts with a title but no channel', () => {
    const shorts = [...doc.querySelectorAll('ytm-shorts-lockup-view-model')];
    expect(shorts.length).toBeGreaterThan(5);
    for (const short of shorts) {
      const info = describeMobileTile(short, null);
      expect(info?.title).toBeTruthy();
      expect(info?.channel).toEqual({ name: null, handle: null, id: null });
    }
  });
});

describe('describeMobileTile on the home feed', () => {
  const doc = loadFixture('youtube-mobile', 'home');

  it('reads title and channel name from lockups, which carry no channel link', () => {
    const items = [...doc.querySelectorAll('ytm-rich-item-renderer')];
    expect(items.length).toBeGreaterThan(10);
    for (const item of items) {
      const info = describeMobileTile(item, null);
      expect(info?.title).toBeTruthy();
      expect(info?.channel.name).toBeTruthy();
    }
  });

  it('reads a known lockup exactly, leaving out the view count and age', () => {
    const item = [...doc.querySelectorAll('ytm-rich-item-renderer')].find((element) =>
      element.querySelector('a[href="/watch?v=2Qze5cVfzV0"]'),
    );
    const info = item && describeMobileTile(item, null);
    expect(info?.channel.name).toBe('เรื่องเล่าเช้านี้');
    expect(info?.title).toContain('น้ำท่วมพหลโยธิน');
  });
});

describe('describeMobileTile on a channel page', () => {
  const doc = loadFixture('youtube-mobile', 'channel-videos');
  const url = new URL('https://m.youtube.com/@3blue1brown/videos');

  it('finds whose channel the page shows', () => {
    expect(pageChannel(url, doc)).toEqual({
      name: '3Blue1Brown',
      handle: '3blue1brown',
      id: null,
    });
  });

  it('falls back on the page channel, since compact videos omit their own', () => {
    const owner = pageChannel(url, doc);
    const tiles = tilesIn(doc);
    expect(tiles.length).toBeGreaterThan(20);
    for (const tile of tiles) {
      expect(describeMobileTile(tile, null)?.channel).toEqual({
        name: null,
        handle: null,
        id: null,
      });
      expect(describeMobileTile(tile, owner)?.channel.handle).toBe('3blue1brown');
    }
  });
});

describe('describeMobileTile edge cases', () => {
  it('returns null for a tile that has no heading yet or never will', () => {
    const doc = new DOMParser().parseFromString(
      '<ytm-video-with-context-renderer><ytm-media-item></ytm-media-item></ytm-video-with-context-renderer>',
      'text/html',
    );
    const tile = doc.querySelector('ytm-video-with-context-renderer') as Element;
    expect(describeMobileTile(tile, null)).toBeNull();
  });

  it('reads a channel id link', () => {
    const doc = new DOMParser().parseFromString(
      `<ytm-video-with-context-renderer>
        <a href="/channel/UC1234567890123456789012"></a>
        <h3>Some video</h3>
      </ytm-video-with-context-renderer>`,
      'text/html',
    );
    const tile = doc.querySelector('ytm-video-with-context-renderer') as Element;
    expect(describeMobileTile(tile, null)?.channel.id).toBe('UC1234567890123456789012');
  });

  it.each(['math·studio', 'math%C2%B7studio'])(
    'preserves the complete handle from /@%s in tiles and page-owner fallbacks',
    (handle) => {
      const doc = new DOMParser().parseFromString(
        `<ytm-video-with-context-renderer>
          <a href="/@${handle}/videos?view=0#top"></a>
          <h3>Matrices explained</h3>
          <ytm-badge-and-byline-renderer><span dir="auto">Math Studio</span></ytm-badge-and-byline-renderer>
        </ytm-video-with-context-renderer>`,
        'text/html',
      );
      const tile = doc.querySelector('ytm-video-with-context-renderer') as Element;
      const info = describeMobileTile(tile, null);
      expect(info?.channel).toEqual({ name: 'Math Studio', handle: 'math·studio', id: null });
      const owner = pageChannel(new URL(`https://m.youtube.com/@${handle}/videos`), doc);
      tile.querySelector('a')?.remove();
      tile.querySelector('ytm-badge-and-byline-renderer')?.remove();
      const inherited = describeMobileTile(tile, owner);
      expect(inherited?.channel.handle).toBe('math·studio');
      for (const channelInfo of [info, inherited]) {
        expect(
          createYoutubeDecider(withFilters({ blockedChannels: ['@math'] }))?.(channelInfo),
        ).toBeNull();
        expect(
          createYoutubeDecider(
            withFilters({ allowedChannels: ['@math'], blockedKeywords: ['matrices'] }),
          )?.(channelInfo),
        ).toBe('blocked-keyword');
        expect(
          createYoutubeDecider(
            withFilters({
              allowedChannels: ['@math'],
              topicMode: 'block',
              topics: [{ name: 'Matrices', keywords: ['matrices'] }],
            }),
          )?.(channelInfo),
        ).toBe('blocked-topic');
        expect(
          createYoutubeDecider(
            withFilters({ allowedChannels: ['@math'], onlyAllowedChannels: true }),
          )?.(channelInfo),
        ).toBe('not-allowed-channel');
      }
      const prefix = {
        title: 'Matrices explained',
        channel: { name: 'Math', handle: 'math', id: null },
      };
      expect(createYoutubeDecider(withFilters({ blockedChannels: ['@math'] }))?.(prefix)).toBe(
        'blocked-channel',
      );
      expect(
        createYoutubeDecider(
          withFilters({ allowedChannels: ['@math'], blockedKeywords: ['matrices'] }),
        )?.(prefix),
      ).toBeNull();
    },
  );

  it('looks up the page channel from the live URL', () => {
    const doc = loadFixture('youtube-mobile', 'channel-videos');
    const source = youtubeMobileTileSource(
      () => new URL('https://m.youtube.com/@3blue1brown/videos'),
    );
    const tile = tilesIn(doc)[0] as Element;
    expect(source.resolveTile(tile)).toBe(tile);
    expect(source.describe(tile)?.channel.handle).toBe('3blue1brown');
  });
});

describe('the channel and word filters on the phone site', () => {
  const search = loadFixture('youtube-mobile', 'search');
  const decide = (filters: Partial<YoutubeFilters>) => {
    const decider = createYoutubeDecider(withFilters(filters));
    return (tile: Element) => decider?.(describeMobileTile(tile, null)) ?? null;
  };
  const byHandle = (handle: string) =>
    tilesIn(search).filter((tile) => tile.querySelector(`a[href="/@${handle}"]`));

  it('hides tiles from a blocked channel and only those', () => {
    const verdict = decide({ blockedChannels: ['@3blue1brown'] });
    const blocked = byHandle('3blue1brown');
    expect(blocked.length).toBeGreaterThan(3);
    for (const tile of blocked) expect(verdict(tile)).toBe('blocked-channel');
    const others = tilesIn(search).filter((tile) => !blocked.includes(tile));
    expect(others.some((tile) => verdict(tile) !== null)).toBe(false);
  });

  it('hides tiles whose title has a blocked word', () => {
    const verdict = decide({ blockedKeywords: ['essence'] });
    const hidden = tilesIn(search).filter((tile) => verdict(tile) === 'blocked-keyword');
    expect(hidden.length).toBeGreaterThan(2);
    for (const tile of hidden) {
      expect(describeMobileTile(tile, null)?.title.toLowerCase()).toContain('essence');
    }
  });

  it('with only allowed channels on, shows nothing else, including Shorts without a channel', () => {
    const verdict = decide({ onlyAllowedChannels: true, allowedChannels: ['3Blue1Brown'] });
    for (const tile of tilesIn(search)) {
      const channel = describeMobileTile(tile, null)?.channel;
      expect(verdict(tile) === null, channel?.name ?? 'no channel').toBe(
        channel?.name === '3Blue1Brown',
      );
    }
  });

  it('filters by topic', () => {
    const verdict = decide({
      topicMode: 'block',
      topics: [{ name: 'Matrices', keywords: ['matrix', 'matrices'] }],
    });
    const hidden = tilesIn(search).filter((tile) => verdict(tile) === 'blocked-topic');
    expect(hidden.length).toBeGreaterThan(1);
  });
});
