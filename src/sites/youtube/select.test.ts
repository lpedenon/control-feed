import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/settings';
import { youtubeSite } from './index';
import { youtubeMobilePage, youtubeMobileSite } from './mobile';
import { MOBILE_YOUTUBE_HOST, youtubeSiteFor } from './select';

describe('youtubeSiteFor', () => {
  it('uses the phone rules only on the phone site', () => {
    expect(MOBILE_YOUTUBE_HOST).toBe('m.youtube.com');
    expect(youtubeSiteFor('m.youtube.com')).toBe(youtubeMobileSite);
  });

  it('keeps the desktop rules for every other YouTube host, including a phone asking for the desktop site', () => {
    for (const host of ['www.youtube.com', 'youtube.com', 'music.youtube.com', '']) {
      expect(youtubeSiteFor(host), host).toBe(youtubeSite);
    }
  });

  it('gives both sites the same settings switches, so one settings page drives both', () => {
    expect(youtubeMobileSite.site).toBe(youtubeSite.site);
    const features = (site: typeof youtubeSite) =>
      site.hideRules.map((rule) => rule.feature).sort();
    expect(features(youtubeMobileSite)).toEqual(features(youtubeSite));
  });
});

describe('youtubeMobilePage', () => {
  it('names the home page and nothing else', () => {
    expect(youtubeMobilePage(new URL('https://m.youtube.com/'))).toBe('home');
    expect(youtubeMobilePage(new URL('https://m.youtube.com/?app=m'))).toBe('home');
    for (const path of [
      '/watch?v=abc',
      '/results?search_query=x',
      '/@3blue1brown/videos',
      '/feed/subscriptions',
    ]) {
      expect(youtubeMobilePage(new URL(`https://m.youtube.com${path}`)), path).toBeNull();
    }
  });

  it('is not set for the desktop site, whose rules do not use it', () => {
    expect(youtubeSite.pageOf).toBeUndefined();
  });
});

describe('redirects on the phone site', () => {
  it('sends a Shorts link to the normal player, as on desktop', () => {
    const shorts = new URL('https://m.youtube.com/shorts/abc123');
    expect(youtubeMobileSite.redirect(shorts, DEFAULT_SETTINGS)).toBe(
      'https://m.youtube.com/watch?v=abc123',
    );
    const video = new URL('https://m.youtube.com/watch?v=x');
    expect(youtubeMobileSite.redirect(video, DEFAULT_SETTINGS)).toBeNull();
  });
});
