import { normalizeText } from './text-match';

/** A subject the user cares about, recognized by words in video titles. */
export interface Topic {
  readonly name: string;
  /** Words or phrases that mark a title as being about this topic. */
  readonly keywords: readonly string[];
}

export const TOPIC_MODES = ['off', 'only', 'block'] as const;
/** Off, show only videos about the topics, or hide videos about them. */
export type TopicMode = (typeof TOPIC_MODES)[number];

/**
 * Starting points for common topics. Adding one copies its words into the
 * user's settings, where they can change them freely. Words that often mean
 * something else ("Java", "React", "Steam") are left out on purpose.
 */
export const TOPIC_PRESETS: readonly Topic[] = [
  {
    name: 'AI',
    keywords: [
      'AI',
      'A.I.',
      'artificial intelligence',
      'machine learning',
      'deep learning',
      'neural network',
      'neural networks',
      'LLM',
      'LLMs',
      'large language model',
      'AGI',
      'GPT',
      'ChatGPT',
      'OpenAI',
      'Claude',
      'Anthropic',
      'Gemini',
      'DeepMind',
      'Copilot',
      'Midjourney',
      'Stable Diffusion',
      'Hugging Face',
      'prompt engineering',
    ],
  },
  {
    name: 'Gaming',
    keywords: [
      'gaming',
      'gameplay',
      'gamer',
      'gamers',
      "let's play",
      'walkthrough',
      'playthrough',
      'speedrun',
      'esports',
      'Minecraft',
      'Fortnite',
      'Roblox',
      'GTA',
      'Call of Duty',
      'Valorant',
      'League of Legends',
      'Counter-Strike',
      'Overwatch',
      'Apex Legends',
      'Elden Ring',
      'Pokémon',
      'Zelda',
      'Nintendo',
      'PlayStation',
      'Xbox',
      'boss fight',
    ],
  },
  {
    name: 'Programming',
    keywords: [
      'programming',
      'coding',
      'programmer',
      'software engineering',
      'software engineer',
      'web development',
      'computer science',
      'JavaScript',
      'TypeScript',
      'Python',
      'C++',
      'algorithms',
      'data structures',
      'LeetCode',
      'GitHub',
      'Linux',
    ],
  },
  {
    name: 'Sports',
    keywords: [
      'football',
      'soccer',
      'basketball',
      'baseball',
      'tennis',
      'golf',
      'cricket',
      'rugby',
      'boxing',
      'NBA',
      'NFL',
      'MLB',
      'NHL',
      'UFC',
      'F1',
      'Formula 1',
      'Premier League',
      'Champions League',
      'World Cup',
      'Olympics',
    ],
  },
  {
    name: 'Politics',
    keywords: [
      'politics',
      'political',
      'election',
      'elections',
      'president',
      'prime minister',
      'congress',
      'senate',
      'parliament',
      'government',
      'democrats',
      'republicans',
      'breaking news',
    ],
  },
  {
    name: 'Music',
    keywords: [
      'music video',
      'official video',
      'official audio',
      'lyrics',
      'lyric video',
      'album',
      'song',
      'songs',
      'concert',
      'remix',
      'live performance',
    ],
  },
  {
    name: 'Investing',
    keywords: [
      'investing',
      'investment',
      'stocks',
      'stock market',
      'ETF',
      'dividend',
      'dividends',
      'trading',
      'crypto',
      'bitcoin',
      'ethereum',
      'personal finance',
      'passive income',
      'real estate',
    ],
  },
  {
    name: 'Movies and TV',
    keywords: [
      'movie',
      'movies',
      'film',
      'trailer',
      'season finale',
      'Netflix',
      'Marvel',
      'box office',
    ],
  },
  {
    name: 'Science',
    keywords: [
      'science',
      'scientist',
      'scientists',
      'physics',
      'chemistry',
      'biology',
      'astronomy',
      'mathematics',
      'math',
      'quantum',
      'NASA',
      'evolution',
    ],
  },
  {
    name: 'Fitness',
    keywords: [
      'workout',
      'fitness',
      'gym',
      'bodybuilding',
      'cardio',
      'strength training',
      'calisthenics',
      'yoga',
      'weight loss',
    ],
  },
  {
    name: 'Cooking',
    keywords: ['recipe', 'recipes', 'cooking', 'baking', 'chef', 'how to cook', 'street food'],
  },
  {
    name: 'Drama and reactions',
    keywords: [
      'drama',
      'reaction',
      'reacts',
      'reacting',
      'exposed',
      'prank',
      'pranks',
      'storytime',
    ],
  },
];

/** Whether two topic names refer to the same topic. */
export function sameTopicName(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

/** The built-in topic with this name, if there is one. */
export function findPreset(name: string): Topic | null {
  return TOPIC_PRESETS.find((preset) => sameTopicName(preset.name, name)) ?? null;
}
