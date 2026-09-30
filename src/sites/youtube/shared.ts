/**
 * Pieces of the YouTube support that the desktop site (www.youtube.com) and
 * the phone site (m.youtube.com) have in common.
 */

/** What replaces the home feed when it is hidden. */
export const HOME_FEED_HIDDEN_MESSAGE =
  'Your home feed is hidden. Search for what you came to learn.';

/** The player's own "watch this next" surfaces; both sites use the same HTML5 player. */
export const PLAYER_END_SCREEN_SELECTORS: readonly string[] = [
  '.html5-endscreen',
  '.ytp-endscreen-content',
  '.ytp-autonav-endscreen',
  '.ytp-videowall-still',
  '.ytp-ce-element',
  '.ytp-fullscreen-grid',
  '.ytp-suggested-action',
];

/**
 * The outermost element matching `selector` that contains `element` (or is
 * it). Layouts nest tiles inside grid cells, and hiding only the inner one
 * would leave an empty slot.
 */
export function outermostMatch(element: Element, selector: string): Element | null {
  let match = element.closest(selector);
  let outer = match?.parentElement?.closest(selector);
  while (outer) {
    match = outer;
    outer = match.parentElement?.closest(selector);
  }
  return match ?? null;
}
