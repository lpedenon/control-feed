import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withFeature, withSite } from './settings';
import { buildStylesheet, HIDDEN_ATTRIBUTE, type HideRule } from './stylesheet';

const RULES: readonly HideRule[] = [
  { feature: 'ytShorts', selectors: ['ytd-reel-shelf-renderer', 'a[href^="/shorts/"]'] },
  {
    feature: 'ytRelated',
    selectors: ['#related'],
    extraCss: '#primary { max-width: none !important; }',
  },
  { feature: 'ytComments', selectors: ['#comments'] },
];

describe('buildStylesheet', () => {
  it('always hides elements the tile filter marked', () => {
    expect(buildStylesheet([], DEFAULT_SETTINGS)).toContain(
      `[${HIDDEN_ATTRIBUTE}] { display: none !important; }`,
    );
  });

  it('writes one rule per selector so one unsupported selector cannot disable the others', () => {
    const css = buildStylesheet(RULES, DEFAULT_SETTINGS);
    expect(css).toContain('ytd-reel-shelf-renderer { display: none !important; }');
    expect(css).toContain('a[href^="/shorts/"] { display: none !important; }');
  });

  it('includes extra css for active rules', () => {
    expect(buildStylesheet(RULES, DEFAULT_SETTINGS)).toContain('#primary { max-width: none');
  });

  it('skips rules for features that are off', () => {
    const css = buildStylesheet(RULES, DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.features.ytComments).toBe(false);
    expect(css).not.toContain('#comments');

    const withComments = buildStylesheet(RULES, withFeature(DEFAULT_SETTINGS, 'ytComments', true));
    expect(withComments).toContain('#comments { display: none !important; }');
  });

  it('skips every rule of a site that is switched off', () => {
    const css = buildStylesheet(RULES, withSite(DEFAULT_SETTINGS, 'youtube', false));
    expect(css).not.toContain('ytd-reel-shelf-renderer');
    expect(css).not.toContain('#related');
  });
});
