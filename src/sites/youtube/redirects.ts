import { isFeatureActive, type Settings } from '../../core/settings';

const SHORT_VIDEO = /^\/shorts\/([\w-]+)\/?$/;
const SHORTS_FEED = /^\/shorts\/?$/;
const EXPLORE = /^\/feed\/(explore|trending)(\/|$)/;

/** Where to send the user instead of `url`, or null to stay. */
export function youtubeRedirect(url: URL, settings: Settings): string | null {
  const { origin, pathname } = url;

  if (isFeatureActive(settings, 'ytShorts')) {
    const id = SHORT_VIDEO.exec(pathname)?.[1];
    if (id) return `${origin}/watch?v=${id}`;
    if (SHORTS_FEED.test(pathname)) return `${origin}/`;
  }

  if (isFeatureActive(settings, 'ytExplore') && EXPLORE.test(pathname)) {
    return `${origin}/`;
  }

  return null;
}
