import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withFeature, withSite } from '../../core/settings';
import { instagramPage, instagramRedirect } from './redirects';

const at = (path: string) => new URL(path, 'https://www.instagram.com');
const FOLLOWING = 'https://www.instagram.com/?variant=following';

describe('instagramRedirect', () => {
  it('opens the Following feed instead of the suggested home feed', () => {
    expect(instagramRedirect(at('/'), DEFAULT_SETTINGS)).toBe(FOLLOWING);
    expect(instagramRedirect(at('/?variant=home'), DEFAULT_SETTINGS)).toBe(FOLLOWING);
  });

  it('stays on the Following feed', () => {
    expect(instagramRedirect(at('/?variant=following'), DEFAULT_SETTINGS)).toBeNull();
  });

  it('sends the Reels feed back to the feed', () => {
    expect(instagramRedirect(at('/reels/'), DEFAULT_SETTINGS)).toBe(FOLLOWING);
    expect(instagramRedirect(at('/reels/DAbc123/'), DEFAULT_SETTINGS)).toBe(FOLLOWING);
    expect(instagramRedirect(at('/reels'), DEFAULT_SETTINGS)).toBe(FOLLOWING);
  });

  it('still opens a single reel someone shared', () => {
    expect(instagramRedirect(at('/reel/DAbc123/'), DEFAULT_SETTINGS)).toBeNull();
  });

  it("keeps the Explore page, which is also Instagram's search page", () => {
    expect(instagramRedirect(at('/explore/'), DEFAULT_SETTINGS)).toBeNull();
    expect(instagramRedirect(at('/explore/search/'), DEFAULT_SETTINGS)).toBeNull();
  });

  it('sends hashtag, location and suggested-people browsing back to the feed', () => {
    expect(instagramRedirect(at('/explore/tags/cats/'), DEFAULT_SETTINGS)).toBe(FOLLOWING);
    expect(instagramRedirect(at('/explore/locations/123/bangkok/'), DEFAULT_SETTINGS)).toBe(
      FOLLOWING,
    );
    expect(instagramRedirect(at('/explore/people/'), DEFAULT_SETTINGS)).toBe(FOLLOWING);
  });

  it('sends blocked pages to the regular home when the Following feed is off', () => {
    const settings = withFeature(DEFAULT_SETTINGS, 'igFollowingFeed', false);
    expect(instagramRedirect(at('/reels/'), settings)).toBe('https://www.instagram.com/');
    expect(instagramRedirect(at('/'), settings)).toBeNull();
  });

  it('leaves profiles, posts and messages alone', () => {
    for (const path of [
      '/natgeo/',
      '/p/abc/',
      '/direct/inbox/',
      '/natgeo/reels/',
      '/stories/natgeo/1/',
    ]) {
      expect(instagramRedirect(at(path), DEFAULT_SETTINGS)).toBeNull();
    }
  });

  it('respects switched-off features and sites', () => {
    expect(
      instagramRedirect(at('/reels/'), withFeature(DEFAULT_SETTINGS, 'igReels', false)),
    ).toBeNull();
    expect(
      instagramRedirect(
        at('/explore/tags/cats/'),
        withFeature(DEFAULT_SETTINGS, 'igExplore', false),
      ),
    ).toBeNull();
    expect(
      instagramRedirect(at('/reels/'), withSite(DEFAULT_SETTINGS, 'instagram', false)),
    ).toBeNull();
  });
});

describe('instagramPage', () => {
  it('recognizes the Explore page only', () => {
    expect(instagramPage(at('/explore/'))).toBe('explore');
    expect(instagramPage(at('/explore/tags/cats/'))).toBeNull();
    expect(instagramPage(at('/'))).toBeNull();
  });
});
