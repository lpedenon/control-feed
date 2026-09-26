import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withFeature, withSite } from '../../core/settings';
import { youtubeRedirect } from './redirects';

const at = (path: string) => new URL(path, 'https://www.youtube.com');

describe('youtubeRedirect', () => {
  it('opens Shorts in the regular player', () => {
    expect(youtubeRedirect(at('/shorts/nIoyae9byFc'), DEFAULT_SETTINGS)).toBe(
      'https://www.youtube.com/watch?v=nIoyae9byFc',
    );
    expect(youtubeRedirect(at('/shorts/nIoyae9byFc?feature=share'), DEFAULT_SETTINGS)).toBe(
      'https://www.youtube.com/watch?v=nIoyae9byFc',
    );
  });

  it('sends the Shorts feed itself home', () => {
    expect(youtubeRedirect(at('/shorts/'), DEFAULT_SETTINGS)).toBe('https://www.youtube.com/');
    expect(youtubeRedirect(at('/shorts'), DEFAULT_SETTINGS)).toBe('https://www.youtube.com/');
  });

  it('sends Explore and Trending home', () => {
    expect(youtubeRedirect(at('/feed/trending'), DEFAULT_SETTINGS)).toBe(
      'https://www.youtube.com/',
    );
    expect(youtubeRedirect(at('/feed/explore?bp=abc'), DEFAULT_SETTINGS)).toBe(
      'https://www.youtube.com/',
    );
  });

  it('leaves everything else alone', () => {
    for (const path of [
      '/',
      '/watch?v=abc',
      '/results?search_query=shorts',
      '/@shorts',
      '/feed/subscriptions',
    ]) {
      expect(youtubeRedirect(at(path), DEFAULT_SETTINGS)).toBeNull();
    }
  });

  it('respects switched-off features and sites', () => {
    expect(
      youtubeRedirect(at('/shorts/abc'), withFeature(DEFAULT_SETTINGS, 'ytShorts', false)),
    ).toBeNull();
    expect(
      youtubeRedirect(at('/feed/trending'), withFeature(DEFAULT_SETTINGS, 'ytExplore', false)),
    ).toBeNull();
    expect(
      youtubeRedirect(at('/shorts/abc'), withSite(DEFAULT_SETTINGS, 'youtube', false)),
    ).toBeNull();
  });

  it('keeps the host the user is on', () => {
    expect(youtubeRedirect(new URL('https://m.youtube.com/shorts/abc'), DEFAULT_SETTINGS)).toBe(
      'https://m.youtube.com/watch?v=abc',
    );
  });
});
