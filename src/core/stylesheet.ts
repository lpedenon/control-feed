import type { FeatureKey } from './features';
import { isFeatureActive, type Settings } from './settings';

/** Set on elements the tile filter decided to hide; the value says why. */
export const HIDDEN_ATTRIBUTE = 'data-control-feed-hidden';

/** Set on the root element to name the current page, for rules that apply to one page. */
export const PAGE_ATTRIBUTE = 'data-control-feed-page';

export interface HideRule {
  readonly feature: FeatureKey;
  /** Elements to remove from the page while the feature is on. */
  readonly selectors: readonly string[];
  /** Any other styling the feature needs, such as widening the player. */
  readonly extraCss?: string;
}

const HIDE = '{ display: none !important; }';

/**
 * Builds the stylesheet for the current settings. Every selector gets its own
 * rule: in a comma-separated list, one selector the browser does not support
 * would invalidate the whole list.
 */
export function buildStylesheet(rules: readonly HideRule[], settings: Settings): string {
  const blocks = rules
    .filter((rule) => isFeatureActive(settings, rule.feature))
    .map((rule) =>
      [
        `/* ${rule.feature} */`,
        ...rule.selectors.map((selector) => `${selector} ${HIDE}`),
        ...(rule.extraCss ? [rule.extraCss] : []),
      ].join('\n'),
    );
  return [`[${HIDDEN_ATTRIBUTE}] ${HIDE}`, ...blocks].join('\n\n');
}
