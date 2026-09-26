export const SITES = ['youtube', 'instagram'] as const;
export type Site = (typeof SITES)[number];

export const SITE_LABELS: Readonly<Record<Site, string>> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
};

export interface FeatureDefinition {
  readonly site: Site;
  readonly group: string;
  readonly label: string;
  readonly description?: string;
  readonly defaultEnabled: boolean;
}

/**
 * Every on/off switch the extension offers. The options page renders from this
 * list and each site's hide rules and redirects are keyed by these names, so
 * adding a feature starts here.
 */
export const FEATURES = {
  ytHomeFeed: {
    site: 'youtube',
    group: 'Browsing',
    label: 'Hide the home feed',
    description: 'youtube.com opens to a quiet page. Search still works.',
    defaultEnabled: true,
  },
  ytShorts: {
    site: 'youtube',
    group: 'Browsing',
    label: 'Hide Shorts',
    description:
      'Removes Shorts shelves, tabs and links. A Shorts link opens in the normal player instead.',
    defaultEnabled: true,
  },
  ytExplore: {
    site: 'youtube',
    group: 'Browsing',
    label: 'Hide Explore and Trending',
    defaultEnabled: true,
  },
  ytRelated: {
    site: 'youtube',
    group: 'While watching',
    label: 'Hide recommended videos next to the player',
    defaultEnabled: true,
  },
  ytEndScreen: {
    site: 'youtube',
    group: 'While watching',
    label: 'Hide end-of-video suggestions',
    description: 'The video wall at the end, clickable end cards and the “more videos” grid.',
    defaultEnabled: true,
  },
  ytComments: {
    site: 'youtube',
    group: 'While watching',
    label: 'Hide comments',
    defaultEnabled: false,
  },
  igFollowingFeed: {
    site: 'instagram',
    group: 'Feed',
    label: 'Show only accounts you follow',
    description: 'Home opens the Following feed: newest first, no suggested posts.',
    defaultEnabled: true,
  },
  igReels: {
    site: 'instagram',
    group: 'Feed',
    label: 'Hide Reels',
    description:
      'Removes the Reels tab and sends the Reels page back to your feed. Reels someone sends you still open.',
    defaultEnabled: true,
  },
  igExplore: {
    site: 'instagram',
    group: 'Feed',
    label: 'Hide Explore',
    description:
      'Removes the grid of recommended posts from the Search page and closes hashtag and place pages. Search still works.',
    defaultEnabled: true,
  },
  igSuggested: {
    site: 'instagram',
    group: 'Feed',
    label: 'Hide suggested accounts',
    defaultEnabled: true,
  },
} as const satisfies Record<string, FeatureDefinition>;

export type FeatureKey = keyof typeof FEATURES;

export const FEATURE_KEYS = Object.keys(FEATURES) as readonly FeatureKey[];

export function featureKeysForSite(site: Site): readonly FeatureKey[] {
  return FEATURE_KEYS.filter((key) => FEATURES[key].site === site);
}
