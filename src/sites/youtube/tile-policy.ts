import type { YoutubeFilters } from '../../core/settings';
import { compileChannelMatcher, compileKeywordMatcher } from '../../core/text-match';
import type { TileDecider } from '../../core/tile-filter';
import type { YoutubeTileInfo } from './tiles';

export type YoutubeHideReason = 'blocked-channel' | 'blocked-keyword' | 'not-allowed-channel';

/**
 * Turns the user's lists into a decision for each tile, or null when there is
 * nothing to filter. Precedence: a blocked channel always hides; an allowed
 * channel is trusted past keyword filters; with "only allowed channels" on,
 * everything else hides, including tiles that cannot be read.
 */
export function createYoutubeDecider(filters: YoutubeFilters): TileDecider<YoutubeTileInfo> | null {
  const { blockedKeywords, blockedChannels, allowedChannels, onlyAllowedChannels } = filters;
  if (!onlyAllowedChannels && blockedKeywords.length === 0 && blockedChannels.length === 0) {
    return null;
  }

  const isBlocked = compileChannelMatcher(blockedChannels);
  const isAllowed = compileChannelMatcher(allowedChannels);
  const findKeyword = compileKeywordMatcher(blockedKeywords);

  return (info): YoutubeHideReason | null => {
    if (info === null) return onlyAllowedChannels ? 'not-allowed-channel' : null;
    if (isBlocked(info.channel)) return 'blocked-channel';
    if (isAllowed(info.channel)) return null;
    if (findKeyword(info.title) !== null) return 'blocked-keyword';
    return onlyAllowedChannels ? 'not-allowed-channel' : null;
  };
}
