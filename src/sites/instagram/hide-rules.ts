import { type HideRule, PAGE_ATTRIBUTE } from '../../core/stylesheet';

/** A post or reel link: what makes a section a grid of content. */
const HAS_POSTS = ':has(a[href^="/p/"], a[href*="/reel/"])';

/**
 * Instagram ships generated class names that change with every build, so these
 * rules rely only on page structure, link targets and form fields.
 * Checked against the live, logged-in site (see e2e/instagram.live.spec.ts).
 */
export const INSTAGRAM_HIDE_RULES: readonly HideRule[] = [
  {
    feature: 'igReels',
    selectors: ['a[href="/reels/"]'],
  },
  {
    feature: 'igExplore',
    // The Explore page doubles as the search page: a search box above a grid
    // of recommendations. Hide the grid, never the part holding the search box
    // (search results appear there).
    selectors: [`html[${PAGE_ATTRIBUTE}="explore"] main > div > div${HAS_POSTS}:not(:has(input))`],
  },
  {
    feature: 'igSuggested',
    // Every "Suggested for you" block has a "See all" link to the suggestions list.
    selectors: ['div:has(> div > a[href="/explore/people/"])', 'a[href="/explore/people/"]'],
  },
];
