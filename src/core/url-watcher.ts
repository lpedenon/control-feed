export interface WatchUrlOptions {
  /** Safety-net polling interval for navigations no event announces. */
  readonly pollMs?: number;
  /** Site events on `document` that fire around in-page navigation. */
  readonly documentEvents?: readonly string[];
}

const DEFAULT_POLL_MS = 500;

interface NavigationLike extends EventTarget {}

/**
 * Calls `onChange` whenever the page URL changes, including single-page-app
 * navigations done with history.pushState. Events give a fast signal where
 * the browser or site provides one; polling guarantees nothing is missed.
 */
export function watchUrl(
  win: Window,
  onChange: (url: URL) => void,
  options: WatchUrlOptions = {},
): () => void {
  let lastHref = win.location.href;

  const check = () => {
    const href = win.location.href;
    if (href === lastHref) return;
    lastHref = href;
    onChange(new URL(href));
  };

  const navigation = (win as Window & { navigation?: NavigationLike }).navigation;
  const documentEvents = options.documentEvents ?? [];

  win.addEventListener('popstate', check);
  navigation?.addEventListener('currententrychange', check);
  for (const type of documentEvents) win.document.addEventListener(type, check);
  const timer = win.setInterval(check, options.pollMs ?? DEFAULT_POLL_MS);

  return () => {
    win.removeEventListener('popstate', check);
    navigation?.removeEventListener('currententrychange', check);
    for (const type of documentEvents) win.document.removeEventListener(type, check);
    win.clearInterval(timer);
  };
}
