import { type ChannelIdentity, parseChannelEntry } from '../../../core/text-match';
import type { TileSource } from '../../../core/tile-filter';
import { outermostMatch } from '../shared';
import { pageChannel, type YoutubeTileInfo } from '../tiles';

/**
 * Elements that represent one video, playlist or Short on the phone site.
 * Home and channel grids wrap their videos in `ytm-rich-item-renderer`, search
 * and related lists use `ytm-video-with-context-renderer`, and both can hold a
 * `yt-lockup-view-model`; tiles are always resolved to the outermost match.
 */
export const MOBILE_TILE_SELECTOR = [
  'ytm-rich-item-renderer',
  'ytm-video-with-context-renderer',
  'ytm-compact-video-renderer',
  'ytm-compact-playlist-renderer',
  'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model',
  'ytm-shorts-lockup-view-model-v2',
].join(', ');

/** Titles are headings on every layout; their class names are generated and change. */
const TITLE_SELECTORS = ['h3[title]', 'h3', 'h4'];

const CHANNEL_LINK_SELECTOR = 'a[href^="/@"], a[href^="/channel/UC"]';

/** Lists and search put the channel first in a byline; separators have no `dir`. */
const BYLINE_PART_SELECTOR = 'ytm-badge-and-byline-renderer > span[dir]';

/**
 * Home lockups have no channel link. As on desktop, the channel name is the
 * first part of the metadata row without an accessibility label; view counts
 * and dates always carry one.
 */
const METADATA_PART_SELECTOR =
  'yt-content-metadata-view-model [role="group"] > span:not([aria-label]):not([aria-hidden])';

const NO_CHANNEL: ChannelIdentity = { name: null, handle: null, id: null };

/** Playlists put "· Playlist" after the channel in the same byline part. */
const BYLINE_SEPARATOR = ' · ';

function cleanText(text: string | null | undefined): string | null {
  const cleaned = text?.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned : null;
}

export function resolveMobileTile(element: Element): Element | null {
  return outermostMatch(element, MOBILE_TILE_SELECTOR);
}

function readTitle(tile: Element): string | null {
  for (const selector of TITLE_SELECTORS) {
    const element = tile.querySelector(selector);
    if (element) return cleanText(element.getAttribute('title')) ?? cleanText(element.textContent);
  }
  return null;
}

function readChannelName(tile: Element): string | null {
  const byline = cleanText(tile.querySelector(BYLINE_PART_SELECTOR)?.textContent);
  if (byline !== null) return cleanText(byline.split(BYLINE_SEPARATOR)[0]);
  return cleanText(tile.querySelector(METADATA_PART_SELECTOR)?.textContent);
}

function readChannel(tile: Element): ChannelIdentity {
  const ref = parseChannelEntry(
    tile.querySelector(CHANNEL_LINK_SELECTOR)?.getAttribute('href') ?? '',
  );
  const handle = ref.kind === 'handle' ? ref.value : null;
  const id = ref.kind === 'id' ? ref.value : null;
  return { name: readChannelName(tile), handle, id };
}

function hasChannel(channel: ChannelIdentity): boolean {
  return channel.name !== null || channel.handle !== null || channel.id !== null;
}

/**
 * Reads what a tile shows. Returns null for tiles that have no title yet
 * (still loading) or never will (ads). `owner` is whose channel page this is:
 * videos there often omit the channel.
 */
export function describeMobileTile(
  tile: Element,
  owner: ChannelIdentity | null,
): YoutubeTileInfo | null {
  const title = readTitle(tile);
  if (title === null) return null;
  const channel = readChannel(tile);
  return { title, channel: hasChannel(channel) ? channel : (owner ?? NO_CHANNEL) };
}

export function youtubeMobileTileSource(currentUrl: () => URL): TileSource<YoutubeTileInfo> {
  return {
    candidateSelector: MOBILE_TILE_SELECTOR,
    resolveTile: resolveMobileTile,
    describe: (tile) => describeMobileTile(tile, pageChannel(currentUrl(), tile.ownerDocument)),
  };
}
