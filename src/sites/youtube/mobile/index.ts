import type { SiteDefinition } from '../../../core/site-runner';
import { youtubeRedirect } from '../redirects';
import { createYoutubeDecider } from '../tile-policy';
import type { YoutubeTileInfo } from '../tiles';
import { YOUTUBE_MOBILE_BASE_CSS, YOUTUBE_MOBILE_HIDE_RULES } from './hide-rules';
import { youtubeMobileTileSource } from './tiles';

/** Names the home page, so the rule that hides the home feed cannot touch a channel's video grid. */
export function youtubeMobilePage(url: URL): string | null {
  return url.pathname === '/' ? 'home' : null;
}

/** Everything the extension does on m.youtube.com, the phone site. */
export const youtubeMobileSite: SiteDefinition<YoutubeTileInfo> = {
  site: 'youtube',
  hideRules: YOUTUBE_MOBILE_HIDE_RULES,
  baseCss: YOUTUBE_MOBILE_BASE_CSS,
  redirect: youtubeRedirect,
  pageOf: youtubeMobilePage,
  tiles: {
    source: youtubeMobileTileSource,
    decider: (settings) => createYoutubeDecider(settings.youtubeFilters),
  },
  // The phone site is a single-page app too; polling covers any navigation these miss.
  navigationEvents: ['yt-navigate-start', 'yt-navigate-finish'],
};
