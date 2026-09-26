import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type YoutubeFilters } from '../../core/settings';
import { createYoutubeDecider } from './tile-policy';
import type { YoutubeTileInfo } from './tiles';

function filters(patch: Partial<YoutubeFilters>): YoutubeFilters {
  return { ...DEFAULT_SETTINGS.youtubeFilters, ...patch };
}

function video(title: string, name: string | null, handle: string | null = null): YoutubeTileInfo {
  return { title, channel: { name, handle, id: null } };
}

describe('createYoutubeDecider', () => {
  it('returns null when no filter is configured, so filtering can stay off', () => {
    expect(createYoutubeDecider(DEFAULT_SETTINGS.youtubeFilters)).toBeNull();
    expect(createYoutubeDecider(filters({ allowedChannels: ['3Blue1Brown'] }))).toBeNull();
  });

  it('hides videos from blocked channels', () => {
    const decide = createYoutubeDecider(filters({ blockedChannels: ['Drama Alert'] }));
    expect(decide?.(video('Anything', 'Drama Alert'))).toBe('blocked-channel');
    expect(decide?.(video('Anything', 'Khan Academy'))).toBeNull();
  });

  it('hides videos whose title has a blocked keyword', () => {
    const decide = createYoutubeDecider(filters({ blockedKeywords: ['prank'] }));
    expect(decide?.(video('Ultimate PRANK compilation', 'Someone'))).toBe('blocked-keyword');
    expect(decide?.(video('Eigenvectors explained', 'Someone'))).toBeNull();
  });

  it('shows tiles it cannot read unless only allowed channels are wanted', () => {
    expect(createYoutubeDecider(filters({ blockedKeywords: ['prank'] }))?.(null)).toBeNull();
    const strict = createYoutubeDecider(filters({ onlyAllowedChannels: true }));
    expect(strict?.(null)).toBe('not-allowed-channel');
  });

  it('with only allowed channels on, hides everything else', () => {
    const decide = createYoutubeDecider(
      filters({ onlyAllowedChannels: true, allowedChannels: ['3Blue1Brown', '@mitocw'] }),
    );
    expect(decide?.(video('Span', '3Blue1Brown'))).toBeNull();
    expect(decide?.(video('18.06', 'MIT OpenCourseWare', 'mitocw'))).toBeNull();
    expect(decide?.(video('Cats', 'Random Channel'))).toBe('not-allowed-channel');
    expect(decide?.(video('A Short', null))).toBe('not-allowed-channel');
  });

  it('hides everything when only allowed channels are wanted but none are listed', () => {
    const decide = createYoutubeDecider(filters({ onlyAllowedChannels: true }));
    expect(decide?.(video('Span', '3Blue1Brown'))).toBe('not-allowed-channel');
  });

  it('lets allowed channels through keyword filters', () => {
    const decide = createYoutubeDecider(
      filters({ blockedKeywords: ['reaction'], allowedChannels: ['Veritasium'] }),
    );
    expect(decide?.(video('Chemical reaction explained', 'Veritasium'))).toBeNull();
    expect(decide?.(video('My reaction to the finale', 'Someone'))).toBe('blocked-keyword');
  });

  it('blocks a channel that is on both lists', () => {
    const decide = createYoutubeDecider(
      filters({ blockedChannels: ['Veritasium'], allowedChannels: ['Veritasium'] }),
    );
    expect(decide?.(video('Anything', 'Veritasium'))).toBe('blocked-channel');
  });
});
