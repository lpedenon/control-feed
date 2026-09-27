import { describe, expect, it } from 'vitest';
import { normalizeList } from './settings';
import { compileKeywordMatcher } from './text-match';
import { findPreset, sameTopicName, TOPIC_PRESETS } from './topics';

function matches(topicName: string, title: string): boolean {
  const preset = findPreset(topicName);
  if (!preset) throw new Error(`No preset named ${topicName}`);
  return compileKeywordMatcher(preset.keywords)(title) !== null;
}

describe('TOPIC_PRESETS', () => {
  it('have unique names and clean, non-empty word lists', () => {
    const names = TOPIC_PRESETS.map((preset) => preset.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const preset of TOPIC_PRESETS) {
      expect(preset.keywords.length).toBeGreaterThan(0);
      expect(normalizeList(preset.keywords)).toEqual(preset.keywords);
    }
  });

  it('recognize typical AI titles and leave others alone', () => {
    expect(matches('AI', 'I built an AI agent in 10 minutes')).toBe(true);
    expect(matches('AI', 'GPT-5 vs Claude: which is better?')).toBe(true);
    expect(matches('AI', 'Neural Networks from scratch')).toBe(true);
    expect(matches('AI', 'What she said about the rain')).toBe(false);
    expect(matches('AI', 'Linear Algebra - Full College Course')).toBe(false);
  });

  it('recognize typical gaming titles', () => {
    expect(matches('Gaming', 'Minecraft Hardcore: 100 days')).toBe(true);
    expect(matches('Gaming', 'Elden Ring boss fight guide')).toBe(true);
    expect(matches('Gaming', 'POKEMON Scarlet Walkthrough Part 1')).toBe(true);
    expect(matches('Gaming', 'The history of the steam engine')).toBe(false);
  });
});

describe('sameTopicName', () => {
  it('ignores case, accents and extra spaces', () => {
    expect(sameTopicName('Movies and TV', '  movies  and tv')).toBe(true);
    expect(sameTopicName('Pokémon', 'pokemon')).toBe(true);
    expect(sameTopicName('AI', 'Gaming')).toBe(false);
  });
});

describe('findPreset', () => {
  it('finds a built-in topic by name', () => {
    expect(findPreset('ai')?.name).toBe('AI');
    expect(findPreset('Chess')).toBeNull();
  });
});
