import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/settings';
import { describeMobileTile, youtubeMobileTileSource } from './mobile/tiles';
import { createYoutubeDecider } from './tile-policy';
import { describeTile, youtubeTileSource } from './tiles';

const readers = [
  {
    name: 'mobile',
    tag: 'ytm-video-with-context-renderer',
    describe: describeMobileTile,
    source: youtubeMobileTileSource,
  },
  { name: 'desktop', tag: 'ytd-video-renderer', describe: describeTile, source: youtubeTileSource },
];

const rules = [
  '@math·studio',
  '@math%C2%B7studio',
  'https://m.youtube.com/@math·studio/videos',
  'https://www.youtube.com/@math%C2%B7studio/videos',
];

describe.each(readers)('$name known publisher identities', (reader) => {
  it.each(['math·studio', 'math%C2%B7studio'])(
    'keeps /@%s distinct from a conflicting known handle with the same display name',
    (handle) => {
      const identities = [handle, 'mathstudio', 'math%73tudio'].map((href) => {
        const doc = new DOMParser().parseFromString(
          `<yt-page-header-view-model><h1>Math Studio</h1></yt-page-header-view-model>
          <${reader.tag}>
            <h3>Matrices explained</h3>
            <ytd-channel-name><a href="/@${href}">Math Studio</a></ytd-channel-name>
            <ytm-badge-and-byline-renderer><span dir="auto">Math Studio</span></ytm-badge-and-byline-renderer>
          </${reader.tag}>`,
          'text/html',
        );
        const tile = doc.querySelector(reader.tag) as Element;
        const linked = reader.describe(tile, null);
        tile.querySelector('ytd-channel-name')?.remove();
        tile.querySelector('ytm-badge-and-byline-renderer')?.remove();
        const inherited = reader
          .source(() => new URL(`https://www.youtube.com/@${href}/videos`))
          .describe(tile);
        expect(linked?.channel.name).toBe('Math Studio');
        expect(inherited?.channel).toEqual(linked?.channel);
        return [linked, inherited];
      });
      const matchingIdentities = identities[0];
      if (!matchingIdentities) throw new Error('Expected matching publisher identities');
      for (const rule of rules) {
        const blocked = createYoutubeDecider({
          ...DEFAULT_SETTINGS.youtubeFilters,
          blockedChannels: [rule],
        });
        const allowedKeywords = createYoutubeDecider({
          ...DEFAULT_SETTINGS.youtubeFilters,
          allowedChannels: [rule],
          blockedKeywords: ['matrices'],
        });
        const allowedTopics = createYoutubeDecider({
          ...DEFAULT_SETTINGS.youtubeFilters,
          allowedChannels: [rule],
          topicMode: 'block',
          topics: [{ name: 'Matrices', keywords: ['matrices'] }],
        });
        const onlyAllowed = createYoutubeDecider({
          ...DEFAULT_SETTINGS.youtubeFilters,
          allowedChannels: [rule],
          onlyAllowedChannels: true,
        });
        for (const info of matchingIdentities) {
          expect(blocked?.(info), rule).toBe('blocked-channel');
          expect(allowedKeywords?.(info), rule).toBeNull();
          expect(allowedTopics?.(info), rule).toBeNull();
          expect(onlyAllowed?.(info), rule).toBeNull();
        }
        for (const info of identities.slice(1).flat()) {
          expect(blocked?.(info), rule).toBeNull();
          expect(allowedKeywords?.(info), rule).toBe('blocked-keyword');
          expect(allowedTopics?.(info), rule).toBe('blocked-topic');
          expect(onlyAllowed?.(info), rule).toBe('not-allowed-channel');
        }
      }
    },
  );
});
