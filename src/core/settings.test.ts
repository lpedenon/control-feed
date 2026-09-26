import { describe, expect, it } from 'vitest';
import { FEATURE_KEYS, FEATURES } from './features';
import {
  DEFAULT_SETTINGS,
  isFeatureActive,
  normalizeList,
  parseSettings,
  settingsEqual,
  withFeature,
  withSite,
  withYoutubeFilters,
} from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('enables both sites', () => {
    expect(DEFAULT_SETTINGS.sites).toEqual({ youtube: true, instagram: true });
  });

  it('uses each feature default from the registry', () => {
    for (const key of FEATURE_KEYS) {
      expect(DEFAULT_SETTINGS.features[key]).toBe(FEATURES[key].defaultEnabled);
    }
  });

  it('starts with empty filters and allowlist mode off', () => {
    expect(DEFAULT_SETTINGS.youtubeFilters).toEqual({
      blockedKeywords: [],
      blockedChannels: [],
      allowedChannels: [],
      onlyAllowedChannels: false,
    });
  });
});

describe('parseSettings', () => {
  it('returns defaults for missing storage', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for garbage input', () => {
    expect(parseSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and fills in missing ones', () => {
    const parsed = parseSettings({
      sites: { youtube: false },
      features: { ytComments: true },
    });
    expect(parsed.sites).toEqual({ youtube: false, instagram: true });
    expect(parsed.features.ytComments).toBe(true);
    expect(parsed.features.ytShorts).toBe(FEATURES.ytShorts.defaultEnabled);
  });

  it('falls back per field when a single value is corrupt', () => {
    const parsed = parseSettings({
      features: { ytShorts: 'yes please', ytComments: true },
      youtubeFilters: { blockedKeywords: 'prank', blockedChannels: ['Drama Channel'] },
    });
    expect(parsed.features.ytShorts).toBe(FEATURES.ytShorts.defaultEnabled);
    expect(parsed.features.ytComments).toBe(true);
    expect(parsed.youtubeFilters.blockedKeywords).toEqual([]);
    expect(parsed.youtubeFilters.blockedChannels).toEqual(['Drama Channel']);
  });

  it('drops unknown keys', () => {
    const parsed = parseSettings({ features: { notAFeature: true }, extra: 1 });
    expect(parsed).toEqual(DEFAULT_SETTINGS);
  });

  it('normalizes list entries', () => {
    const parsed = parseSettings({
      youtubeFilters: { blockedKeywords: ['  prank ', '', 'Prank', 'reaction', 3] },
    });
    expect(parsed.youtubeFilters.blockedKeywords).toEqual(['prank', 'reaction']);
  });
});

describe('normalizeList', () => {
  it('trims, drops blanks and removes case-insensitive duplicates keeping the first', () => {
    expect(normalizeList(['  Foo', 'bar ', '', '   ', 'FOO', 'Bar'])).toEqual(['Foo', 'bar']);
  });

  it('collapses inner whitespace', () => {
    expect(normalizeList(['you   won’t\tbelieve'])).toEqual(['you won’t believe']);
  });
});

describe('immutable updates', () => {
  it('withFeature returns a new object and leaves the original untouched', () => {
    const next = withFeature(DEFAULT_SETTINGS, 'ytComments', true);
    expect(next.features.ytComments).toBe(true);
    expect(DEFAULT_SETTINGS.features.ytComments).toBe(false);
    expect(next).not.toBe(DEFAULT_SETTINGS);
  });

  it('withSite toggles one site only', () => {
    const next = withSite(DEFAULT_SETTINGS, 'instagram', false);
    expect(next.sites).toEqual({ youtube: true, instagram: false });
    expect(DEFAULT_SETTINGS.sites.instagram).toBe(true);
  });

  it('withYoutubeFilters merges a patch and normalizes lists', () => {
    const next = withYoutubeFilters(DEFAULT_SETTINGS, {
      blockedKeywords: [' prank', 'PRANK'],
      onlyAllowedChannels: true,
    });
    expect(next.youtubeFilters).toEqual({
      blockedKeywords: ['prank'],
      blockedChannels: [],
      allowedChannels: [],
      onlyAllowedChannels: true,
    });
    expect(DEFAULT_SETTINGS.youtubeFilters.onlyAllowedChannels).toBe(false);
  });
});

describe('isFeatureActive', () => {
  it('requires both the feature and its site to be on', () => {
    expect(isFeatureActive(DEFAULT_SETTINGS, 'ytShorts')).toBe(true);
    expect(isFeatureActive(withSite(DEFAULT_SETTINGS, 'youtube', false), 'ytShorts')).toBe(false);
    expect(isFeatureActive(withFeature(DEFAULT_SETTINGS, 'ytShorts', false), 'ytShorts')).toBe(
      false,
    );
  });
});

describe('settingsEqual', () => {
  it('treats settings built different ways but holding the same values as equal', () => {
    const toggledTwice = withFeature(
      withFeature(DEFAULT_SETTINGS, 'ytShorts', false),
      'ytShorts',
      true,
    );
    const reparsed = parseSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
    expect(settingsEqual(toggledTwice, DEFAULT_SETTINGS)).toBe(true);
    expect(settingsEqual(reparsed, DEFAULT_SETTINGS)).toBe(true);
  });

  it('notices any single difference', () => {
    expect(settingsEqual(withSite(DEFAULT_SETTINGS, 'youtube', false), DEFAULT_SETTINGS)).toBe(
      false,
    );
    expect(settingsEqual(withFeature(DEFAULT_SETTINGS, 'igReels', false), DEFAULT_SETTINGS)).toBe(
      false,
    );
    expect(
      settingsEqual(
        withYoutubeFilters(DEFAULT_SETTINGS, { blockedKeywords: ['a'] }),
        DEFAULT_SETTINGS,
      ),
    ).toBe(false);
    expect(
      settingsEqual(
        withYoutubeFilters(DEFAULT_SETTINGS, { allowedChannels: ['a', 'b'] }),
        withYoutubeFilters(DEFAULT_SETTINGS, { allowedChannels: ['b', 'a'] }),
      ),
    ).toBe(false);
  });
});
