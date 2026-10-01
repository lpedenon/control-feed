import { HIDDEN_ATTRIBUTE, type HideRule, PAGE_ATTRIBUTE } from '../../../core/stylesheet';
import { HOME_FEED_HIDDEN_MESSAGE, PLAYER_END_SCREEN_SELECTORS } from '../shared';

const SHORTS_LOCKUPS = 'ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2';

/** Set by `youtubeMobilePage`: the home feed and a channel's video grid share their elements. */
const ON_HOME = `html[${PAGE_ATTRIBUTE}="home"]`;

/**
 * Rules for the phone site (m.youtube.com), whose markup differs from the
 * desktop site's (`ytm-*` elements, a bottom pivot bar). Like the desktop
 * rules they use tag names, attributes and link targets, and avoid the
 * generated class names. The `.pivot-shorts` and `.related-items-container`
 * classes are the exceptions: they are readable names YouTube uses for what
 * they hold. Checked against the snapshots in e2e/fixtures/youtube-mobile.
 */
export const YOUTUBE_MOBILE_HIDE_RULES: readonly HideRule[] = [
  {
    feature: 'ytHomeFeed',
    selectors: [`${ON_HOME} ytm-rich-grid-renderer`],
    extraCss: `${ON_HOME} ytm-single-column-browse-results-renderer {
  display: block;
}
${ON_HOME} ytm-single-column-browse-results-renderer::before {
  content: "${HOME_FEED_HIDDEN_MESSAGE}";
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 96px;
  padding: 0 24px;
  text-align: center;
  font-family: "Roboto", "Arial", sans-serif;
  font-size: 16px;
  line-height: 22px;
  color: var(--yt-spec-text-secondary, #606060);
}`,
  },
  {
    feature: 'ytShorts',
    selectors: [
      'ytm-shorts-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2',
      `grid-shelf-view-model:has(${SHORTS_LOCKUPS})`,
      `ytm-rich-section-renderer:has(${SHORTS_LOCKUPS})`,
      `ytm-rich-item-renderer:has(${SHORTS_LOCKUPS}, a[href^="/shorts/"])`,
      'ytm-video-with-context-renderer:has(a[href^="/shorts/"])',
      'ytm-compact-video-renderer:has(a[href^="/shorts/"])',
      'yt-lockup-view-model:has(a[href^="/shorts/"])',
      // The bottom bar's Shorts tab has no link, only this marker class.
      'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
      'yt-tab-shape[tab-title="Shorts"]',
    ],
  },
  {
    feature: 'ytExplore',
    // The chip on the home feed that opens the Explore and Trending drawer.
    selectors: ['ytm-chip-cloud-chip-renderer[chip-style="STYLE_EXPLORE_LAUNCHER_CHIP"]'],
  },
  {
    feature: 'ytRelated',
    selectors: [
      'ytm-item-section-renderer[section-identifier="related-items"]',
      '.related-items-container',
      '.ytp-pause-overlay',
    ],
  },
  {
    feature: 'ytEndScreen',
    selectors: PLAYER_END_SCREEN_SELECTORS,
  },
  {
    feature: 'ytComments',
    selectors: [
      // The comments entry under a video is the only item section that has no
      // identifier and holds a metadata carousel; unlike its label, that is
      // the same in every language.
      'ytm-item-section-renderer:not([section-identifier]):has(yt-video-metadata-carousel-view-model)',
      'ytm-comments-entry-point-header-renderer',
    ],
  },
];

const hidden = `[${HIDDEN_ATTRIBUTE}]`;
const visible = `:not([${HIDDEN_ATTRIBUTE}])`;

/** Removes sections whose every video was filtered out, so no empty headings remain. */
export const YOUTUBE_MOBILE_BASE_CSS = [
  `ytm-rich-section-renderer:has(ytm-rich-item-renderer${hidden}):not(:has(ytm-rich-item-renderer${visible}))`,
]
  .map((selector) => `${selector} { display: none !important; }`)
  .join('\n');
