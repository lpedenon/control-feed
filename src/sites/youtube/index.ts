import type { SiteDefinition } from '../../core/site-runner';
import { YOUTUBE_BASE_CSS, YOUTUBE_HIDE_RULES } from './hide-rules';
import { youtubeRedirect } from './redirects';
import { createYoutubeDecider } from './tile-policy';
import { type YoutubeTileInfo, youtubeTileSource } from './tiles';

export const youtubeSite: SiteDefinition<YoutubeTileInfo> = {
  site: 'youtube',
  hideRules: YOUTUBE_HIDE_RULES,
  baseCss: YOUTUBE_BASE_CSS,
  redirect: youtubeRedirect,
  tiles: {
    source: youtubeTileSource,
    decider: (settings) => createYoutubeDecider(settings.youtubeFilters),
  },
  // Fired by YouTube's router before and after every in-app page change.
  navigationEvents: ['yt-navigate-start', 'yt-navigate-finish'],
};
