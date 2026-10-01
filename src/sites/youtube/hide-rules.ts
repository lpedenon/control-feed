import { HIDDEN_ATTRIBUTE, type HideRule } from '../../core/stylesheet';
import { HOME_FEED_HIDDEN_MESSAGE, PLAYER_END_SCREEN_SELECTORS } from './shared';

/**
 * Things in the watch page's right-hand column worth keeping it for: an open
 * playlist, live chat, or a panel such as the transcript. The ad panel does not count.
 */
const WATCH_SIDEBAR_IN_USE = [
  'ytd-playlist-panel-renderer:not([hidden])',
  'ytd-live-chat-frame:not([hidden])',
  'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]:not([target-id*="ads"])',
].join(', ');

/**
 * Desktop element names are ytd-*, newer shared components yt-* and ytm-*,
 * player chrome .ytp-*. Selectors avoid YouTube's generated class names, which
 * change often; tag names, ids, attributes and link targets are far steadier.
 * Checked against the snapshots in e2e/fixtures/youtube.
 */
export const YOUTUBE_HIDE_RULES: readonly HideRule[] = [
  {
    feature: 'ytHomeFeed',
    selectors: ['ytd-browse[page-subtype="home"] ytd-rich-grid-renderer'],
    extraCss: `ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer {
  width: 100% !important;
  max-width: none !important;
}
ytd-browse[page-subtype="home"] ytd-two-column-browse-results-renderer::before {
  content: "${HOME_FEED_HIDDEN_MESSAGE}";
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 160px;
  padding: 0 24px;
  text-align: center;
  font-family: "Roboto", "Arial", sans-serif;
  font-size: 1.6rem;
  line-height: 2.2rem;
  color: var(--yt-spec-text-secondary, #606060);
}`,
  },
  {
    feature: 'ytShorts',
    selectors: [
      'ytd-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
      'grid-shelf-view-model:has(ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)',
      'ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model, a[href^="/shorts/"])',
      'ytd-video-renderer:has(a[href^="/shorts/"])',
      'yt-lockup-view-model:has(a[href^="/shorts/"])',
      'ytm-shorts-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2',
      'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
      'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
      'yt-tab-shape[tab-title="Shorts"]',
      'ytd-notification-renderer:has(a[href^="/shorts/"])',
    ],
  },
  {
    feature: 'ytExplore',
    selectors: [
      'ytd-guide-section-renderer:has(a[href^="/feed/trending"], a[href^="/feed/explore"])',
      'ytd-guide-entry-renderer:has(a[href^="/feed/trending"], a[href^="/feed/explore"])',
      'ytd-mini-guide-entry-renderer:has(a[href^="/feed/trending"], a[href^="/feed/explore"])',
    ],
  },
  {
    feature: 'ytRelated',
    selectors: [
      'ytd-watch-flexy #related',
      'ytd-watch-next-secondary-results-renderer',
      '.ytp-pause-overlay',
      // Drop the right-hand column too, unless it holds something the viewer opened.
      `ytd-watch-flexy #secondary:not(:has(${WATCH_SIDEBAR_IN_USE}))`,
    ],
    // With the column gone YouTube stretches the player; keep it centered and
    // small enough that the title stays above the fold.
    extraCss: `ytd-watch-flexy:not([theater]):not([fullscreen]) #primary {
  max-width: max(640px, calc((100vh - 240px) * 16 / 9)) !important;
}`,
  },
  {
    feature: 'ytEndScreen',
    selectors: PLAYER_END_SCREEN_SELECTORS,
  },
  {
    feature: 'ytComments',
    selectors: ['ytd-comments#comments', 'ytd-comments-entry-point-header-renderer'],
  },
];

const hidden = `[${HIDDEN_ATTRIBUTE}]`;
const visible = `:not([${HIDDEN_ATTRIBUTE}])`;

/** Removes shelves whose every video was filtered out, so no empty headings remain. */
export const YOUTUBE_BASE_CSS = [
  `ytd-rich-section-renderer:has(ytd-rich-item-renderer${hidden}):not(:has(ytd-rich-item-renderer${visible}))`,
  `grid-shelf-view-model:has(${hidden}):not(:has(:is(yt-lockup-view-model, ytm-shorts-lockup-view-model-v2)${visible}))`,
  `ytd-shelf-renderer:has(${hidden}):not(:has(:is(ytd-video-renderer, yt-lockup-view-model)${visible}))`,
]
  .map((selector) => `${selector} { display: none !important; }`)
  .join('\n');
