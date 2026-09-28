import { isFeatureActive, type Settings } from '../../core/settings';

const REELS_FEED = /^\/reels(\/|$)/;
/**
 * Pages under /explore/ such as places and suggested people. The /explore/
 * page itself stays: it is also Instagram's search page, and only its
 * recommendation grid is hidden (see hide-rules.ts).
 *
 * Unfinished: Instagram now answers hashtag pages (/explore/tags/...) with a
 * keyword search page (/explore/search/keyword/?q=%23tag), which this lets
 * through, so hashtag grids stay visible. See https://github.com/lpedenon/no-brainrot/issues/2
 */
const EXPLORE_BROWSING = /^\/explore\/(?!search(\/|$))[^/]+/;
const FOLLOWING_VARIANT = 'following';

function homeUrl(origin: string, settings: Settings): string {
  return isFeatureActive(settings, 'igFollowingFeed')
    ? `${origin}/?variant=${FOLLOWING_VARIANT}`
    : `${origin}/`;
}

/** Where to send the user instead of `url`, or null to stay. */
export function instagramRedirect(url: URL, settings: Settings): string | null {
  const { origin, pathname, searchParams } = url;

  if (isFeatureActive(settings, 'igReels') && REELS_FEED.test(pathname)) {
    return homeUrl(origin, settings);
  }

  if (isFeatureActive(settings, 'igExplore') && EXPLORE_BROWSING.test(pathname)) {
    return homeUrl(origin, settings);
  }

  if (
    isFeatureActive(settings, 'igFollowingFeed') &&
    pathname === '/' &&
    searchParams.get('variant') !== FOLLOWING_VARIANT
  ) {
    return homeUrl(origin, settings);
  }

  return null;
}

/** Names the kind of page, so styles can target one page (see site-runner). */
export function instagramPage(url: URL): string | null {
  if (url.pathname === '/explore/' || url.pathname === '/explore') return 'explore';
  return null;
}
