import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings, withFeature, withSite } from './settings';
import { type SiteDefinition, type SiteRunner, STYLE_ELEMENT_ID, startSite } from './site-runner';
import { HIDDEN_ATTRIBUTE, PAGE_ATTRIBUTE } from './stylesheet';

interface FakeInfo {
  readonly title: string;
}

/** A window whose location can be steered and whose navigations are recorded. */
function fakeWindow(initialHref: string) {
  let href = initialHref;
  const replace = vi.fn((target: string) => {
    href = target;
  });
  const win = {
    document,
    location: {
      get href() {
        return href;
      },
      replace,
    },
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
  } as unknown as Window;
  return { win, replace, navigate: (next: string) => (href = next) };
}

const definition: SiteDefinition<FakeInfo> = {
  site: 'youtube',
  hideRules: [
    { feature: 'ytShorts', selectors: ['.short'] },
    { feature: 'ytComments', selectors: ['.comments'] },
  ],
  baseCss: '.base {}',
  pageOf: (url) => (url.pathname === '/explore/' ? 'explore' : null),
  redirect: (url, settings) =>
    settings.features.ytShorts && url.pathname === '/shorts' ? `${url.origin}/` : null,
  tiles: {
    source: () => ({
      candidateSelector: '.tile',
      resolveTile: (element) => element.closest('.tile'),
      describe: (tile) => ({ title: tile.textContent ?? '' }),
    }),
    decider: (settings: Settings) =>
      settings.features.ytComments ? (info) => (info?.title === 'bad' ? 'keyword' : null) : null,
  },
};

const style = () => document.getElementById(STYLE_ELEMENT_ID);
let runner: SiteRunner | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div class="tile" id="bad">bad</div><div class="tile">good</div>';
});

afterEach(() => {
  runner?.stop();
  runner = undefined;
  vi.useRealTimers();
});

describe('startSite', () => {
  it('protects the page with default styles before settings load', () => {
    const { win, replace } = fakeWindow('https://example.test/shorts');
    runner = startSite(win, definition);
    expect(style()?.dataset.settings).toBe('default');
    expect(style()?.textContent).toContain('.short { display: none !important; }');
    expect(style()?.textContent).toContain('.base {}');
    expect(replace).not.toHaveBeenCalled();
  });

  it('applies stored settings: styles, redirects and tile filtering', () => {
    const { win, replace } = fakeWindow('https://example.test/shorts');
    runner = startSite(win, definition);
    runner.apply(withFeature(DEFAULT_SETTINGS, 'ytComments', true));
    expect(style()?.dataset.settings).toBe('stored');
    expect(style()?.textContent).toContain('.comments');
    expect(replace).toHaveBeenCalledWith('https://example.test/');
    expect(document.getElementById('bad')?.getAttribute(HIDDEN_ATTRIBUTE)).toBe('keyword');
  });

  it('does nothing on a site that is switched off', () => {
    const { win, replace } = fakeWindow('https://example.test/shorts');
    runner = startSite(win, definition);
    runner.apply(withSite(withFeature(DEFAULT_SETTINGS, 'ytComments', true), 'youtube', false));
    expect(style()?.textContent).toBe('');
    expect(replace).not.toHaveBeenCalled();
    expect(document.getElementById('bad')?.hasAttribute(HIDDEN_ATTRIBUTE)).toBe(false);
  });

  it('checks for redirects again after in-page navigation', () => {
    const { win, replace, navigate } = fakeWindow('https://example.test/watch');
    runner = startSite(win, definition);
    runner.apply(DEFAULT_SETTINGS);
    expect(replace).not.toHaveBeenCalled();
    navigate('https://example.test/shorts');
    vi.advanceTimersByTime(1000);
    expect(replace).toHaveBeenCalledWith('https://example.test/');
  });

  it('names the current page on the root element and keeps it current', () => {
    const { win, navigate } = fakeWindow('https://example.test/explore/');
    runner = startSite(win, definition);
    expect(document.documentElement.getAttribute(PAGE_ATTRIBUTE)).toBe('explore');
    navigate('https://example.test/somewhere');
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.hasAttribute(PAGE_ATTRIBUTE)).toBe(false);
  });

  it('cleans up after itself', () => {
    const { win } = fakeWindow('https://example.test/explore/');
    runner = startSite(win, definition);
    runner.apply(withFeature(DEFAULT_SETTINGS, 'ytComments', true));
    runner.stop();
    runner = undefined;
    expect(style()).toBeNull();
    expect(document.documentElement.hasAttribute(PAGE_ATTRIBUTE)).toBe(false);
    expect(document.getElementById('bad')?.hasAttribute(HIDDEN_ATTRIBUTE)).toBe(false);
  });
});
