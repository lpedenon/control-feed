import type { YoutubeFilters } from '../../core/settings';
import { compileChannelMatcher, compileKeywordMatcher } from '../../core/text-match';
import type { TileDecider } from '../../core/tile-filter';
import type { YoutubeTileInfo } from './tiles';

export type YoutubeHideReason =
  | 'blocked-channel'
  | 'blocked-keyword'
  | 'blocked-topic'
  | 'not-allowed-channel'
  | 'off-topic';

/**
 * Turns the user's lists into a decision for each tile, or null when there is
 * nothing to filter. Precedence: a blocked channel always hides; an allowed
 * channel is trusted past word and topic filters; then blocked words, then
 * topics. With "only allowed channels" or "only these topics" on, a video
 * shows when it passes either one and everything else hides, including tiles
 * that cannot be read.
 */
export function createYoutubeDecider(filters: YoutubeFilters): TileDecider<YoutubeTileInfo> | null {
  const { blockedKeywords, blockedChannels, allowedChannels, onlyAllowedChannels } = filters;
  const topicWords = filters.topics.flatMap((topic) => topic.keywords);
  const onlyTopics = filters.topicMode === 'only';
  const blockTopics = filters.topicMode === 'block' && topicWords.length > 0;
  if (
    !onlyAllowedChannels &&
    !onlyTopics &&
    !blockTopics &&
    blockedKeywords.length === 0 &&
    blockedChannels.length === 0
  ) {
    return null;
  }

  const isBlocked = compileChannelMatcher(blockedChannels);
  const isAllowed = compileChannelMatcher(allowedChannels);
  const findKeyword = compileKeywordMatcher(blockedKeywords);
  const findTopicWord = compileKeywordMatcher(topicWords);
  const notWanted: YoutubeHideReason | null = onlyAllowedChannels
    ? 'not-allowed-channel'
    : onlyTopics
      ? 'off-topic'
      : null;

  return (info): YoutubeHideReason | null => {
    if (info === null) return notWanted;
    if (isBlocked(info.channel)) return 'blocked-channel';
    if (isAllowed(info.channel)) return null;
    if (findKeyword(info.title) !== null) return 'blocked-keyword';
    const onTopic = findTopicWord(info.title) !== null;
    if (blockTopics && onTopic) return 'blocked-topic';
    if (onlyTopics && onTopic) return null;
    return notWanted;
  };
}
