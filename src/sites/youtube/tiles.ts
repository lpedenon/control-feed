import type { ChannelIdentity } from '../../core/text-match';
import type { TileSource } from '../../core/tile-filter';

export interface YoutubeTileInfo {
  readonly title: string;
  readonly channel: ChannelIdentity;
}

/**
 * Elements that represent one video, playlist or Short. Newer layouts nest a
 * yt-lockup-view-model inside a ytd-rich-item-renderer grid cell, so tiles are
 * always resolved to the outermost match to avoid leaving empty grid slots.
 */
export const TILE_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-playlist-renderer',
  'ytd-radio-renderer',
  'ytd-reel-item-renderer',
  'yt-lockup-view-model',
  'ytm-shorts-lockup-view-model',
  'ytm-shorts-lockup-view-model-v2',
].join(', ');

/** Title elements in order of preference. */
const TITLE_SELECTORS = ['#video-title', 'h3[title]', 'h3 a[title]', 'h3'];

/** Where a tile links to its channel. Descriptions can mention other channels, so stay in these. */
const CHANNEL_LINK_SELECTOR =
  'ytd-channel-name a[href], #channel-info a[href], yt-content-metadata-view-model a[href]';

/**
 * Lines of text under a lockup's title. The channel name is the first part
 * without an accessibility label; view counts and dates always carry one
 * ("802 thousand views", "2 months ago"), in every UI language.
 */
const METADATA_PART_SELECTOR =
  'yt-content-metadata-view-model [role="group"] > span:not([aria-label]):not([aria-hidden])';

const HANDLE_HREF = /^\/@([^/?#]+)/;
const CHANNEL_ID_HREF = /^\/channel\/(UC[\w-]{22})/;

const NO_CHANNEL: ChannelIdentity = { name: null, handle: null, id: null };

function cleanText(text: string | null | undefined): string | null {
  const cleaned = text?.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned : null;
}

export function resolveTile(element: Element): Element | null {
  let tile = element.closest(TILE_SELECTOR);
  let outer = tile?.parentElement?.closest(TILE_SELECTOR);
  while (outer) {
    tile = outer;
    outer = tile.parentElement?.closest(TILE_SELECTOR);
  }
  return tile ?? null;
}

function readTitle(tile: Element): string | null {
  for (const selector of TITLE_SELECTORS) {
    const element = tile.querySelector(selector);
    if (element) return cleanText(element.getAttribute('title')) ?? cleanText(element.textContent);
  }
  return null;
}

function readChannel(tile: Element): ChannelIdentity {
  let handle: string | null = null;
  let id: string | null = null;
  let linkName: string | null = null;
  for (const link of tile.querySelectorAll(CHANNEL_LINK_SELECTOR)) {
    const href = link.getAttribute('href') ?? '';
    const linkHandle = HANDLE_HREF.exec(href)?.[1];
    const linkId = CHANNEL_ID_HREF.exec(href)?.[1];
    if (!linkHandle && !linkId) continue;
    handle ??= linkHandle ? decodeURIComponent(linkHandle).toLowerCase() : null;
    id ??= linkId ?? null;
    linkName ??= cleanText(link.textContent);
    if (linkName) break;
  }

  const name =
    cleanText(tile.querySelector('ytd-channel-name #text')?.textContent) ??
    linkName ??
    [...tile.querySelectorAll(METADATA_PART_SELECTOR)]
      .map((part) => cleanText(part.textContent))
      .find((text) => text !== null) ??
    null;

  return { name, handle, id };
}

function hasChannel(channel: ChannelIdentity): boolean {
  return channel.name !== null || channel.handle !== null || channel.id !== null;
}

/**
 * Reads what a tile shows. Returns null for tiles that have no title yet
 * (still loading) or never will (ads).
 */
export function describeTile(tile: Element, owner: ChannelIdentity | null): YoutubeTileInfo | null {
  const title = readTitle(tile);
  if (title === null) return null;
  const channel = readChannel(tile);
  return { title, channel: hasChannel(channel) ? channel : (owner ?? NO_CHANNEL) };
}

/** On a channel page, whose channel it is. Videos there often omit the channel name. */
export function pageChannel(url: URL, doc: Document): ChannelIdentity | null {
  const handle = HANDLE_HREF.exec(url.pathname)?.[1];
  const id = CHANNEL_ID_HREF.exec(url.pathname)?.[1];
  if (!handle && !id) return null;
  return {
    name: cleanText(doc.querySelector('yt-page-header-view-model h1')?.textContent),
    handle: handle ? decodeURIComponent(handle).toLowerCase() : null,
    id: id ?? null,
  };
}

export function youtubeTileSource(currentUrl: () => URL): TileSource<YoutubeTileInfo> {
  return {
    candidateSelector: TILE_SELECTOR,
    resolveTile,
    describe: (tile) => describeTile(tile, pageChannel(currentUrl(), tile.ownerDocument)),
  };
}
