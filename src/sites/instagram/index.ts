import type { SiteDefinition } from '../../core/site-runner';
import { INSTAGRAM_HIDE_RULES } from './hide-rules';
import { instagramPage, instagramRedirect } from './redirects';

export const instagramSite: SiteDefinition<never> = {
  site: 'instagram',
  hideRules: INSTAGRAM_HIDE_RULES,
  redirect: instagramRedirect,
  pageOf: instagramPage,
};
