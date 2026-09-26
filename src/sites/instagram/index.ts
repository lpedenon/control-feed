import type { SiteDefinition } from '../../core/site-runner';
import { INSTAGRAM_HIDE_RULES } from './hide-rules';
import { instagramPage, instagramRedirect } from './redirects';

/**
 * Instagram support is unfinished: hashtag grids get through, and only the
 * desktop layout in English has been checked. What works, what does not and
 * where to start: https://github.com/lpedenon/control-feed/issues/2
 */
export const instagramSite: SiteDefinition<never> = {
  site: 'instagram',
  hideRules: INSTAGRAM_HIDE_RULES,
  redirect: instagramRedirect,
  pageOf: instagramPage,
};
