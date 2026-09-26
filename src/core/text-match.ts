/** Who published a piece of content, as far as the page lets us tell. */
export interface ChannelIdentity {
  readonly name: string | null;
  /** Lowercase handle without the leading "@". */
  readonly handle: string | null;
  readonly id: string | null;
}

export type ChannelRef =
  | { readonly kind: 'handle'; readonly value: string }
  | { readonly kind: 'id'; readonly value: string }
  | { readonly kind: 'name'; readonly value: string };

const COMBINING_MARKS = /\p{M}+/gu;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;
const CHANNEL_ID = /^UC[\w-]{22}$/;
const URL_HANDLE = /(?:^|\/)@([\w.-]+)/;
const URL_CHANNEL_ID = /\/channel\/(UC[\w-]{22})/;
/** Scripts that separate words with spaces, where whole-word matching makes sense. */
const SPACED_SCRIPT_EDGE = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}]/u;
const WORD_CHAR_BEFORE = '(?<![\\p{L}\\p{N}])';
const WORD_CHAR_AFTER = '(?![\\p{L}\\p{N}])';

/** Case-, accent- and width-insensitive form used for every comparison. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(text: string): string {
  return normalizeText(text).replace(NON_ALPHANUMERIC, '');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordPattern(normalizedKeyword: string): RegExp {
  const first = normalizedKeyword.slice(0, 1);
  const last = normalizedKeyword.slice(-1);
  const before = SPACED_SCRIPT_EDGE.test(first) ? WORD_CHAR_BEFORE : '';
  const after = SPACED_SCRIPT_EDGE.test(last) ? WORD_CHAR_AFTER : '';
  return new RegExp(`${before}${escapeRegExp(normalizedKeyword)}${after}`, 'u');
}

/**
 * Builds a matcher that returns the first keyword (as the user typed it) found
 * in a text, or null. Words in space-separated scripts only match whole words,
 * so "ai" does not hide "said".
 */
export function compileKeywordMatcher(
  keywords: readonly string[],
): (text: string) => string | null {
  const patterns = keywords
    .map((keyword) => ({ keyword, normalized: normalizeText(keyword) }))
    .filter(({ normalized }) => normalized !== '')
    .map(({ keyword, normalized }) => ({ keyword, pattern: keywordPattern(normalized) }));

  return (text) => {
    if (patterns.length === 0) return null;
    const normalizedText = normalizeText(text);
    return patterns.find(({ pattern }) => pattern.test(normalizedText))?.keyword ?? null;
  };
}

/** Reads a list entry as an @handle, a channel id, a channel URL or a display name. */
export function parseChannelEntry(entry: string): ChannelRef {
  const trimmed = entry.trim();
  const urlChannelId = URL_CHANNEL_ID.exec(trimmed)?.[1];
  if (urlChannelId) return { kind: 'id', value: urlChannelId };
  if (CHANNEL_ID.test(trimmed)) return { kind: 'id', value: trimmed };
  const handle = URL_HANDLE.exec(trimmed)?.[1];
  if (handle) return { kind: 'handle', value: handle.toLowerCase() };
  return { kind: 'name', value: normalizeText(trimmed) };
}

function matchesRef(ref: ChannelRef, channel: ChannelIdentity): boolean {
  switch (ref.kind) {
    case 'id':
      return channel.id === ref.value;
    case 'handle':
      // Many surfaces only show the display name, which often spells the handle.
      return (
        channel.handle === ref.value ||
        (channel.name !== null && compact(channel.name) === compact(ref.value))
      );
    case 'name': {
      const compactRef = compact(ref.value);
      return (
        (channel.name !== null && normalizeText(channel.name) === ref.value) ||
        (channel.name !== null && compact(channel.name) === compactRef) ||
        (channel.handle !== null && compact(channel.handle) === compactRef)
      );
    }
  }
}

/** Builds a predicate telling whether a channel is on the given list. */
export function compileChannelMatcher(
  entries: readonly string[],
): (channel: ChannelIdentity) => boolean {
  const refs = entries.map(parseChannelEntry).filter((ref) => ref.value !== '');
  return (channel) => refs.some((ref) => matchesRef(ref, channel));
}
