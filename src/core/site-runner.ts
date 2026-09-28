import type { Site } from './features';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { createStyleInjector } from './style-injector';
import { buildStylesheet, type HideRule, PAGE_ATTRIBUTE } from './stylesheet';
import { startTileFilter, type TileDecider, type TileFilter, type TileSource } from './tile-filter';
import { watchUrl } from './url-watcher';

export interface SiteTiles<Info> {
  source(currentUrl: () => URL): TileSource<Info>;
  /** The decision rule for these settings, or null when nothing needs filtering. */
  decider(settings: Settings): TileDecider<Info> | null;
}

/** Everything the extension does on one site. */
export interface SiteDefinition<Info> {
  readonly site: Site;
  readonly hideRules: readonly HideRule[];
  /** Extra CSS that is always present while the site is enabled. */
  readonly baseCss?: string;
  redirect(url: URL, settings: Settings): string | null;
  /** Names the kind of page at `url`, exposed on the root element for page-specific rules. */
  pageOf?(url: URL): string | null;
  readonly tiles?: SiteTiles<Info>;
  /** Events the site fires on document around in-page navigation. */
  readonly navigationEvents?: readonly string[];
}

export interface SiteRunner {
  apply(settings: Settings): void;
  stop(): void;
}

export const STYLE_ELEMENT_ID = 'no-brainrot-style';

/**
 * Starts the extension on a page. Styles for the default settings go in
 * immediately so nothing distracting flashes while stored settings load;
 * redirects and tile filtering wait for `apply` with the real settings.
 */
export function startSite<Info>(win: Window, definition: SiteDefinition<Info>): SiteRunner {
  const doc = win.document;
  const styles = createStyleInjector(doc, STYLE_ELEMENT_ID);
  const currentUrl = () => new URL(win.location.href);
  const tileFilter: TileFilter<Info> | null = definition.tiles
    ? startTileFilter(doc.documentElement, definition.tiles.source(currentUrl), null)
    : null;
  let settings: Settings | null = null;

  const renderStyles = (active: Settings, source: 'default' | 'stored') => {
    const css = active.sites[definition.site]
      ? `${buildStylesheet(definition.hideRules, active)}\n\n${definition.baseCss ?? ''}`
      : '';
    styles.update(css, source);
  };

  const markPage = () => {
    const page = definition.pageOf?.(currentUrl()) ?? null;
    if (page === null) doc.documentElement.removeAttribute(PAGE_ATTRIBUTE);
    else doc.documentElement.setAttribute(PAGE_ATTRIBUTE, page);
  };

  const redirectIfNeeded = () => {
    if (settings === null || !settings.sites[definition.site]) return;
    const target = definition.redirect(currentUrl(), settings);
    if (target !== null && target !== win.location.href) win.location.replace(target);
  };

  const stopWatchingUrl = watchUrl(
    win,
    () => {
      markPage();
      redirectIfNeeded();
      tileFilter?.rescan();
    },
    definition.navigationEvents ? { documentEvents: definition.navigationEvents } : {},
  );

  markPage();
  renderStyles(DEFAULT_SETTINGS, 'default');

  return {
    apply(next) {
      settings = next;
      renderStyles(next, 'stored');
      redirectIfNeeded();
      const enabled = next.sites[definition.site];
      tileFilter?.setDecider(enabled && definition.tiles ? definition.tiles.decider(next) : null);
    },
    stop() {
      stopWatchingUrl();
      tileFilter?.stop();
      styles.remove();
      doc.documentElement.removeAttribute(PAGE_ATTRIBUTE);
    },
  };
}
