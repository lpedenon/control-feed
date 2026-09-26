import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../test-support/fixtures';
import { describeTile, pageChannel, resolveTile, TILE_SELECTOR, youtubeTileSource } from './tiles';

function tilesIn(doc: Document, scope = ''): Element[] {
  const candidates = doc.querySelectorAll(scope ? `${scope} :is(${TILE_SELECTOR})` : TILE_SELECTOR);
  return [
    ...new Set([...candidates].map(resolveTile).filter((tile) => tile !== null)),
  ] as Element[];
}

describe('resolveTile', () => {
  it('returns the outermost tile for anything inside it', () => {
    const doc = loadFixture('youtube', 'home');
    const lockup = doc.querySelector('ytd-rich-item-renderer yt-lockup-view-model');
    const title = lockup?.querySelector('h3');
    expect(lockup && resolveTile(lockup)?.tagName).toBe('YTD-RICH-ITEM-RENDERER');
    expect(title && resolveTile(title)?.tagName).toBe('YTD-RICH-ITEM-RENDERER');
  });

  it('returns null outside of tiles', () => {
    const doc = loadFixture('youtube', 'home');
    const searchBox = doc.querySelector('input, form, #masthead');
    expect(searchBox && resolveTile(searchBox)).toBeNull();
  });
});

describe('describeTile on search results', () => {
  const doc = loadFixture('youtube', 'search');

  it('reads title, channel name and handle of every video result', () => {
    const results = [...doc.querySelectorAll('ytd-video-renderer')];
    expect(results.length).toBeGreaterThan(5);
    for (const result of results) {
      const info = describeTile(result, null);
      expect(info?.title).toBeTruthy();
      expect(info?.channel.name).toBeTruthy();
      expect(info?.channel.handle).toMatch(/^[\w.-]+$/);
    }
  });

  it('reads a known result exactly', () => {
    const result = [...doc.querySelectorAll('ytd-video-renderer')].find((element) =>
      element.querySelector('a[href="/@3blue1brown"]'),
    );
    const info = result && describeTile(result, null);
    expect(info?.channel).toEqual({ name: '3Blue1Brown', handle: '3blue1brown', id: null });
    expect(info?.title).toMatch(/linear/i);
  });

  it('reads playlist lockups with their channel link', () => {
    const playlist = [...doc.querySelectorAll('yt-lockup-view-model')].find(
      (element) => element.querySelector('h3[title]') && element.querySelector('a[href^="/@"]'),
    );
    const info = playlist && describeTile(playlist, null);
    expect(info?.title).toBeTruthy();
    expect(info?.channel.name).toBeTruthy();
    expect(info?.channel.handle).toBeTruthy();
  });

  it('reads Shorts titles even though they show no channel', () => {
    const short = doc.querySelector('ytm-shorts-lockup-view-model');
    const info = short && describeTile(short, null);
    expect(info?.title).toBeTruthy();
    expect(info?.channel).toEqual({ name: null, handle: null, id: null });
  });
});

describe('describeTile on the home feed', () => {
  const doc = loadFixture('youtube', 'home');
  const tiles = tilesIn(doc, 'ytd-browse[page-subtype="home"]');

  it('finds the feed tiles', () => {
    expect(tiles.length).toBeGreaterThan(20);
  });

  it('reads channel names and handles of regular videos', () => {
    const videos = tiles
      .filter((tile) => tile.querySelector('yt-lockup-view-model h3'))
      .map((tile) => describeTile(tile, null));
    expect(videos.length).toBeGreaterThan(10);
    for (const info of videos) {
      expect(info?.title).toBeTruthy();
      expect(info?.channel.name).toBeTruthy();
      expect(info?.channel.handle).toBeTruthy();
    }
  });

  it('treats ads as not content', () => {
    const ad = tiles.find((tile) => tile.querySelector('ytd-ad-slot-renderer'));
    expect(ad).toBeDefined();
    expect(ad && describeTile(ad, null)).toBeNull();
  });
});

describe('describeTile next to the player', () => {
  const doc = loadFixture('youtube', 'watch');
  const related = tilesIn(doc, '#related').filter((tile) => tile.querySelector('h3'));

  it('reads channel names from the first metadata line, which has no link', () => {
    expect(related.length).toBeGreaterThan(10);
    const infos = related.map((tile) => describeTile(tile, null));
    for (const info of infos) {
      expect(info?.channel.name).toBeTruthy();
      expect(info?.channel.name).not.toMatch(/views|ago/i);
    }
    expect(infos.some((info) => info?.channel.name === '3Blue1Brown')).toBe(true);
  });
});

describe('describeTile on a channel page', () => {
  const doc = loadFixture('youtube', 'channel-videos');
  const url = new URL('https://www.youtube.com/@3blue1brown/videos');
  const owner = pageChannel(url, doc);

  it('knows whose channel page it is', () => {
    expect(owner).toEqual({ name: '3Blue1Brown', handle: '3blue1brown', id: null });
  });

  it('credits videos without a channel line to the page owner', () => {
    const tiles = tilesIn(doc);
    expect(tiles.length).toBeGreaterThan(20);
    for (const tile of tiles) {
      expect(describeTile(tile, owner)?.channel.name).toBe('3Blue1Brown');
    }
  });

  it('does not mistake view counts for channel names', () => {
    const plain = tilesIn(doc).find(
      (tile) => !tile.textContent?.includes('and ') && tile.querySelector('h3'),
    );
    expect(plain && describeTile(plain, null)?.channel.name).toBeNull();
  });
});

describe('pageChannel', () => {
  const doc = document.implementation.createHTMLDocument('');

  it('reads channel ids from /channel/ URLs', () => {
    expect(
      pageChannel(new URL('https://www.youtube.com/channel/UCYO_jab_esuFRV4b17AJtAw'), doc),
    ).toEqual({ name: null, handle: null, id: 'UCYO_jab_esuFRV4b17AJtAw' });
  });

  it('returns null away from channel pages', () => {
    expect(pageChannel(new URL('https://www.youtube.com/results?search_query=x'), doc)).toBeNull();
    expect(pageChannel(new URL('https://www.youtube.com/watch?v=abc'), doc)).toBeNull();
  });
});

describe('youtubeTileSource', () => {
  it('reads the page channel from the current location', () => {
    const doc = loadFixture('youtube', 'channel-videos');
    const source = youtubeTileSource(() => new URL('https://www.youtube.com/@3blue1brown/videos'));
    // A solo upload: its tile shows no channel line, so the page owner applies.
    const tile = [...doc.querySelectorAll('ytd-rich-item-renderer')].find(
      (element) => !element.textContent?.includes('and '),
    );
    expect(tile && source.describe(tile)?.channel.handle).toBe('3blue1brown');
  });
});
