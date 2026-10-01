import type { SiteDefinition } from '../../core/site-runner';
import { youtubeSite } from './index';
import { youtubeMobileSite } from './mobile';
import type { YoutubeTileInfo } from './tiles';

/** The phone site has its own markup; every other YouTube host gets the desktop rules. */
export const MOBILE_YOUTUBE_HOST = 'm.youtube.com';

export function youtubeSiteFor(hostname: string): SiteDefinition<YoutubeTileInfo> {
  return hostname === MOBILE_YOUTUBE_HOST ? youtubeMobileSite : youtubeSite;
}
