import { z } from 'zod';
import { FEATURE_KEYS, FEATURES, type FeatureKey, SITES, type Site } from './features';
import { findPreset, sameTopicName, TOPIC_MODES, type Topic, type TopicMode } from './topics';

export interface YoutubeFilters {
  /** Hide videos whose title contains any of these words or phrases. */
  readonly blockedKeywords: readonly string[];
  /** Hide videos from these channels (name, @handle or channel id). */
  readonly blockedChannels: readonly string[];
  /** Channels always welcome; with `onlyAllowedChannels` the only ones shown. */
  readonly allowedChannels: readonly string[];
  readonly onlyAllowedChannels: boolean;
  /** Whether `topics` are the only ones shown, are hidden, or are ignored. */
  readonly topicMode: TopicMode;
  readonly topics: readonly Topic[];
}

export interface Settings {
  readonly sites: Readonly<Record<Site, boolean>>;
  readonly features: Readonly<Record<FeatureKey, boolean>>;
  readonly youtubeFilters: YoutubeFilters;
}

/**
 * Trims entries, collapses inner whitespace, drops blanks and removes
 * case-insensitive duplicates while keeping the first spelling the user typed.
 */
export function normalizeList(entries: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    const cleaned = entry.replace(/\s+/g, ' ').trim();
    const key = cleaned.toLocaleLowerCase();
    if (cleaned === '' || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

const listSchema = z
  .array(z.unknown())
  .transform((items) => normalizeList(items.filter((item) => typeof item === 'string')))
  .catch([]);

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** Drops topics without a name and keeps the first of any two with the same name. */
const topicsSchema = z
  .array(z.unknown())
  .transform((items): readonly Topic[] => {
    const topics: Topic[] = [];
    for (const item of items) {
      if (!isRecord(item)) continue;
      const name = cleanName(item.name);
      if (name === '' || topics.some((topic) => sameTopicName(topic.name, name))) continue;
      topics.push({ name, keywords: listSchema.parse(item.keywords) });
    }
    return topics;
  })
  .catch([]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** An object schema that treats any non-object input as empty, so each field falls back on its own. */
function lenientObject<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.preprocess((value) => (isRecord(value) ? value : {}), z.object(shape));
}

const settingsSchema = lenientObject({
  sites: lenientObject(Object.fromEntries(SITES.map((site) => [site, z.boolean().catch(true)]))),
  features: lenientObject(
    Object.fromEntries(
      FEATURE_KEYS.map((key) => [key, z.boolean().catch(FEATURES[key].defaultEnabled)]),
    ),
  ),
  youtubeFilters: lenientObject({
    blockedKeywords: listSchema,
    blockedChannels: listSchema,
    allowedChannels: listSchema,
    onlyAllowedChannels: z.boolean().catch(false),
    topicMode: z.enum(TOPIC_MODES).catch('off'),
    topics: topicsSchema,
  }),
});

/**
 * Turns whatever is in storage into valid settings. Anything missing or
 * corrupt falls back to its default one field at a time, so a single bad value
 * never switches off the rest of the user's choices.
 */
export function parseSettings(raw: unknown): Settings {
  return settingsSchema.parse(raw) as Settings;
}

export const DEFAULT_SETTINGS: Settings = parseSettings(undefined);

export function isFeatureActive(settings: Settings, key: FeatureKey): boolean {
  return settings.sites[FEATURES[key].site] && settings.features[key];
}

export function withFeature(settings: Settings, key: FeatureKey, enabled: boolean): Settings {
  return { ...settings, features: { ...settings.features, [key]: enabled } };
}

export function withSite(settings: Settings, site: Site, enabled: boolean): Settings {
  return { ...settings, sites: { ...settings.sites, [site]: enabled } };
}

export function withYoutubeFilters(settings: Settings, patch: Partial<YoutubeFilters>): Settings {
  return parseSettings({
    ...settings,
    youtubeFilters: { ...settings.youtubeFilters, ...patch },
  });
}

/**
 * Adds a topic by name, starting from the built-in words when there is a
 * preset with that name and from the name itself otherwise. A name already
 * on the list is left alone.
 */
export function withTopicAdded(settings: Settings, name: string): Settings {
  const cleaned = cleanName(name);
  const { topics } = settings.youtubeFilters;
  if (cleaned === '' || topics.some((topic) => sameTopicName(topic.name, cleaned))) {
    return settings;
  }
  const topic = findPreset(cleaned) ?? { name: cleaned, keywords: [cleaned] };
  return withYoutubeFilters(settings, { topics: [...topics, topic] });
}

export function withTopicRemoved(settings: Settings, name: string): Settings {
  const topics = settings.youtubeFilters.topics.filter((topic) => !sameTopicName(topic.name, name));
  return withYoutubeFilters(settings, { topics });
}

export function withTopicKeywords(
  settings: Settings,
  name: string,
  keywords: readonly string[],
): Settings {
  const topics = settings.youtubeFilters.topics.map((topic) =>
    sameTopicName(topic.name, name) ? { ...topic, keywords } : topic,
  );
  return withYoutubeFilters(settings, { topics });
}

const LIST_FIELDS = ['blockedKeywords', 'blockedChannels', 'allowedChannels'] as const;

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

/** Field-by-field equality, independent of how the objects were built. */
export function settingsEqual(a: Settings, b: Settings): boolean {
  return (
    SITES.every((site) => a.sites[site] === b.sites[site]) &&
    FEATURE_KEYS.every((key) => a.features[key] === b.features[key]) &&
    a.youtubeFilters.onlyAllowedChannels === b.youtubeFilters.onlyAllowedChannels &&
    LIST_FIELDS.every((field) => sameList(a.youtubeFilters[field], b.youtubeFilters[field])) &&
    a.youtubeFilters.topicMode === b.youtubeFilters.topicMode &&
    a.youtubeFilters.topics.length === b.youtubeFilters.topics.length &&
    a.youtubeFilters.topics.every((topic, index) => {
      const other = b.youtubeFilters.topics[index];
      return other?.name === topic.name && sameList(topic.keywords, other.keywords);
    })
  );
}
