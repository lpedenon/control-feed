import { describe, expect, it } from 'vitest';
import {
  type ChannelIdentity,
  compileChannelMatcher,
  compileKeywordMatcher,
  normalizeText,
  parseChannelEntry,
} from './text-match';

function channel(partial: Partial<ChannelIdentity>): ChannelIdentity {
  return { name: null, handle: null, id: null, ...partial };
}

describe('normalizeText', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalizeText('  Café   CRÈME\tBrûlée ')).toBe('cafe creme brulee');
  });

  it('folds compatibility characters', () => {
    expect(normalizeText('ＰＲＡＮＫ')).toBe('prank');
  });
});

describe('compileKeywordMatcher', () => {
  it('returns null when there are no keywords', () => {
    expect(compileKeywordMatcher([])('Anything at all')).toBeNull();
  });

  it('matches whole words case-insensitively and returns the keyword as typed', () => {
    const match = compileKeywordMatcher(['Prank', 'reaction']);
    expect(match('EPIC PRANK on my brother')).toBe('Prank');
    expect(match('My reaction to the finale')).toBe('reaction');
    expect(match('Linear algebra, chapter 1')).toBeNull();
  });

  it('does not match inside other words', () => {
    const match = compileKeywordMatcher(['ai']);
    expect(match('She said hello')).toBeNull();
    expect(match('How AI works')).toBe('ai');
    expect(match('AI-generated art')).toBe('ai');
  });

  it('matches multi-word phrases', () => {
    const match = compileKeywordMatcher(["you won't believe"]);
    expect(match("You Won't Believe what happened next")).toBe("you won't believe");
  });

  it('ignores accents on either side', () => {
    const match = compileKeywordMatcher(['telenovela']);
    expect(match('Mejores escenas de la TELENOVÉLA')).toBe('telenovela');
  });

  it('treats regex characters literally', () => {
    const match = compileKeywordMatcher(['c++', '(live)']);
    expect(match('Learn C++ in 10 minutes')).toBe('c++');
    expect(match('Concert (LIVE) 2026')).toBe('(live)');
    expect(match('Learn C in 10 minutes')).toBeNull();
  });

  it('matches keywords from scripts without spaces anywhere in the text', () => {
    const match = compileKeywordMatcher(['ดราม่า']);
    expect(match('รวมดราม่าล่าสุด')).toBe('ดราม่า');
  });

  it('matches hashtags', () => {
    const match = compileKeywordMatcher(['#shorts']);
    expect(match('Fast tip #Shorts')).toBe('#shorts');
  });
});

describe('parseChannelEntry', () => {
  it('reads @handles', () => {
    expect(parseChannelEntry('@3Blue1Brown')).toEqual({ kind: 'handle', value: '3blue1brown' });
  });

  it.each([
    '@Math·Studio',
    '@Math%C2%B7Studio',
    '/@Math·Studio/videos',
    '/@Math%C2%B7Studio/videos',
    'https://m.youtube.com/@Math·Studio/videos?view=0#top',
    'https://www.youtube.com/@Math%C2%B7Studio/videos?view=0#top',
  ])('reads the complete literal or encoded handle from %s', (entry) => {
    expect(parseChannelEntry(`  ${entry}  `)).toEqual({ kind: 'handle', value: 'math·studio' });
  });

  it.each(['@Café', '@Caf%C3%A9', '@数学', '@%E6%95%B0%E5%AD%A6'])(
    'reads supported non-ASCII handles from %s',
    (entry) => {
      const expected = entry.startsWith('@Caf') ? 'café' : '数学';
      expect(parseChannelEntry(entry)).toEqual({ kind: 'handle', value: expected });
    },
  );

  it.each(['@math%', '@math%ZZstudio', 'https://m.youtube.com/@math%C2/videos'])(
    'treats invalid handle encoding as a name without throwing: %s',
    (entry) => {
      expect(parseChannelEntry(entry)).toEqual({ kind: 'name', value: normalizeText(entry) });
      expect(compileChannelMatcher([entry])(channel({ handle: 'other-channel' }))).toBe(false);
    },
  );

  it('reads channel ids', () => {
    expect(parseChannelEntry('UCYO_jab_esuFRV4b17AJtAw')).toEqual({
      kind: 'id',
      value: 'UCYO_jab_esuFRV4b17AJtAw',
    });
  });

  it('reads channel URLs', () => {
    expect(parseChannelEntry('https://www.youtube.com/@mitocw/videos')).toEqual({
      kind: 'handle',
      value: 'mitocw',
    });
    expect(parseChannelEntry('youtube.com/channel/UCYO_jab_esuFRV4b17AJtAw')).toEqual({
      kind: 'id',
      value: 'UCYO_jab_esuFRV4b17AJtAw',
    });
  });

  it('treats anything else as a display name', () => {
    expect(parseChannelEntry('MIT OpenCourseWare')).toEqual({
      kind: 'name',
      value: 'mit opencourseware',
    });
  });
});

describe('compileChannelMatcher', () => {
  it('matches nothing when the list is empty', () => {
    expect(compileChannelMatcher([])(channel({ name: 'Anyone' }))).toBe(false);
  });

  it('matches display names regardless of case and accents', () => {
    const matches = compileChannelMatcher(['mit opencourseware', 'Café Física']);
    expect(matches(channel({ name: 'MIT OpenCourseWare' }))).toBe(true);
    expect(matches(channel({ name: 'Cafe Fisica' }))).toBe(true);
    expect(matches(channel({ name: 'MIT' }))).toBe(false);
  });

  it('matches @handles against handles', () => {
    const matches = compileChannelMatcher(['@mitocw']);
    expect(matches(channel({ name: 'MIT OpenCourseWare', handle: 'mitocw' }))).toBe(true);
    expect(matches(channel({ name: 'Other', handle: 'other' }))).toBe(false);
  });

  it.each([
    '@math·studio',
    '@math%C2%B7studio',
    'https://m.youtube.com/@math·studio/videos?view=0#top',
    'https://www.youtube.com/@math%C2%B7studio/videos?view=0#top',
  ])('matches %s to the complete identity rather than its prefix', (entry) => {
    const matches = compileChannelMatcher([entry]);
    expect(matches(channel({ handle: 'math·studio' }))).toBe(true);
    expect(matches(channel({ handle: 'math' }))).toBe(false);
    expect(matches(channel({ name: 'Math', handle: 'math' }))).toBe(false);
    expect(matches(channel({ name: 'Math Studio', handle: 'mathstudio' }))).toBe(false);
    expect(matches(channel({ name: 'Math Studio', handle: 'math·studio' }))).toBe(true);
    expect(matches(channel({ name: 'Math Studio' }))).toBe(true);
    expect(
      compileChannelMatcher(['Math Studio'])(
        channel({ name: 'Math Studio', handle: 'mathstudio' }),
      ),
    ).toBe(true);
    expect(compileChannelMatcher(['@math'])(channel({ handle: 'math·studio' }))).toBe(false);
  });

  it('matches an @handle against a name that spells the same', () => {
    const matches = compileChannelMatcher(['@3blue1brown']);
    expect(matches(channel({ name: '3Blue1Brown' }))).toBe(true);
  });

  it('matches a name entry against a handle that spells the same', () => {
    const matches = compileChannelMatcher(['3Blue1Brown']);
    expect(matches(channel({ handle: '3blue1brown' }))).toBe(true);
  });

  it('matches channel ids exactly', () => {
    const matches = compileChannelMatcher(['UCYO_jab_esuFRV4b17AJtAw']);
    expect(matches(channel({ id: 'UCYO_jab_esuFRV4b17AJtAw' }))).toBe(true);
    expect(matches(channel({ id: 'UCYO_jab_esuFRV4b17AJtAX' }))).toBe(false);
  });

  it('never matches an unknown channel', () => {
    const matches = compileChannelMatcher(['@mitocw', 'Some Name']);
    expect(matches(channel({}))).toBe(false);
  });
});
