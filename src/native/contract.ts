import { FEATURE_KEYS, FEATURES, SITES } from '../core/features';
import {
  DEFAULT_SETTINGS,
  normalizeList,
  parseSettings,
  type Settings,
  withFeature,
  withSite,
  withTopicAdded,
  withTopicKeywords,
  withTopicRemoved,
  withYoutubeFilters,
} from '../core/settings';
import { sameTopicName, TOPIC_MODES, TOPIC_PRESETS } from '../core/topics';
import {
  CONTACT_REASONS,
  PROTOCOL_VERSION,
  SITE_ACCESS_VALUES,
  SITE_HOSTS,
  type SyncRequest,
} from './protocol';

/**
 * What the Swift side (ios/Packages/NoBrainrotKit) must agree with, generated
 * from the TypeScript that defines it. The Swift tests read the result and
 * replay every vector against their own code, so the two cannot drift apart
 * unnoticed. Regenerate with `pnpm ios:contract`.
 */

const RAW_SETTINGS_INPUTS: readonly { readonly name: string; readonly input: unknown }[] = [
  { name: 'nothing', input: null },
  { name: 'not an object', input: 'settings' },
  { name: 'an array', input: [1, 2, 3] },
  { name: 'empty object', input: {} },
  {
    name: 'wrong types everywhere',
    input: {
      sites: { youtube: 'yes', instagram: 3 },
      features: { ytShorts: 'maybe', ytComments: 1 },
      youtubeFilters: {
        blockedKeywords: 'prank',
        onlyAllowedChannels: 'true',
        topicMode: 'sometimes',
        topics: 'AI',
      },
    },
  },
  {
    name: 'one bad value leaves the rest alone',
    input: { features: { ytShorts: 'maybe', ytComments: true, ytExplore: false } },
  },
  {
    name: 'lists are trimmed, collapsed and de-duplicated',
    input: {
      youtubeFilters: {
        blockedKeywords: ['  Prank ', 'prank', 'You   won’t believe', '', 3, null, 'PRANK'],
        blockedChannels: ['@Some.Channel', '@some.channel', 'Other  Channel'],
        allowedChannels: ['École Polytechnique', 'ÉCOLE POLYTECHNIQUE', 'école polytechnique'],
      },
    },
  },
  {
    name: 'topics are cleaned and de-duplicated by name',
    input: {
      youtubeFilters: {
        topicMode: 'only',
        topics: [
          { name: '  AI ', keywords: ['LLM', 'llm', ' GPT '] },
          { name: 'ai', keywords: ['duplicate'] },
          { name: '', keywords: ['nameless'] },
          { name: 'Café', keywords: 'not a list' },
          { keywords: ['no name'] },
          'not a topic',
          { name: 'Cafe', keywords: ['second spelling'] },
        ],
      },
    },
  },
  {
    name: 'everything valid',
    input: {
      sites: { youtube: false, instagram: true },
      features: { ytHomeFeed: false, ytShorts: false, ytComments: true, igReels: false },
      youtubeFilters: {
        blockedKeywords: ['a'],
        blockedChannels: ['b'],
        allowedChannels: ['c'],
        onlyAllowedChannels: true,
        topicMode: 'block',
        topics: [{ name: 'Gaming', keywords: ['gameplay'] }],
      },
    },
  },
  { name: 'unknown keys are dropped', input: { extra: 1, features: { nope: true } } },
];

const NORMALIZE_LIST_INPUTS: readonly (readonly string[])[] = [
  [],
  ['a', 'A', ' a  '],
  ['  spaced   out  ', 'spaced out'],
  ['', '   ', '\t'],
  ['École', 'ÉCOLE', 'école', 'Ecole'],
  ['Straße', 'STRASSE', 'strasse'],
  ['İstanbul', 'i̇stanbul'],
  ['ΑΒΓ', 'αβγ', 'ΑΒς', 'αβσ'],
  ['日本語', '日本語 '],
  ['line\nbreak', 'line break'],
];

const TOPIC_NAME_PAIRS: readonly (readonly [string, string])[] = [
  ['AI', 'ai'],
  ['AI', ' A I '],
  ['Café', 'Cafe'],
  ['Café', 'CAFÉ'],
  ['ＡＩ', 'ai'],
  ['Gaming', 'Gamer'],
  ['', ' '],
  ['Straße', 'strasse'],
];

type Operation =
  | { readonly op: 'site'; readonly site: string; readonly enabled: boolean }
  | { readonly op: 'feature'; readonly key: string; readonly enabled: boolean }
  | { readonly op: 'filters'; readonly patch: Record<string, unknown> }
  | { readonly op: 'topicAdd'; readonly name: string }
  | { readonly op: 'topicRemove'; readonly name: string }
  | {
      readonly op: 'topicKeywords';
      readonly name: string;
      readonly keywords: readonly string[];
    };

function apply(settings: Settings, operation: Operation): Settings {
  switch (operation.op) {
    case 'site':
      return withSite(settings, operation.site as (typeof SITES)[number], operation.enabled);
    case 'feature':
      return withFeature(
        settings,
        operation.key as (typeof FEATURE_KEYS)[number],
        operation.enabled,
      );
    case 'filters':
      return withYoutubeFilters(settings, operation.patch);
    case 'topicAdd':
      return withTopicAdded(settings, operation.name);
    case 'topicRemove':
      return withTopicRemoved(settings, operation.name);
    case 'topicKeywords':
      return withTopicKeywords(settings, operation.name, operation.keywords);
  }
}

const EDIT_SEQUENCES: readonly {
  readonly name: string;
  readonly operations: readonly Operation[];
}[] = [
  {
    name: 'switches',
    operations: [
      { op: 'feature', key: 'ytShorts', enabled: false },
      { op: 'feature', key: 'ytComments', enabled: true },
      { op: 'site', site: 'youtube', enabled: false },
    ],
  },
  {
    name: 'list edits are cleaned',
    operations: [
      {
        op: 'filters',
        patch: { blockedKeywords: ['  Prank ', 'prank', 'Reaction'] },
      },
      { op: 'filters', patch: { onlyAllowedChannels: true, allowedChannels: ['@a', '@A'] } },
    ],
  },
  {
    name: 'topics: preset, custom, duplicate, keywords, remove',
    operations: [
      { op: 'filters', patch: { topicMode: 'only' } },
      { op: 'topicAdd', name: 'ai' },
      { op: 'topicAdd', name: '  Woodworking  ' },
      { op: 'topicAdd', name: 'AI' },
      { op: 'topicAdd', name: '   ' },
      { op: 'topicKeywords', name: 'woodworking', keywords: ['dovetail', 'Dovetail', ' jig '] },
      { op: 'topicKeywords', name: 'missing', keywords: ['ignored'] },
      { op: 'topicRemove', name: 'AI' },
      { op: 'topicRemove', name: 'missing' },
    ],
  },
  {
    name: 'a bad patch is repaired rather than stored',
    operations: [{ op: 'filters', patch: { topicMode: 'sometimes', blockedKeywords: [] } }],
  },
];

const SYNC_REQUEST_EXAMPLE: SyncRequest = {
  type: 'sync',
  protocolVersion: PROTOCOL_VERSION,
  extensionVersion: '1.2.3',
  reason: 'page',
  settings: withFeature(DEFAULT_SETTINGS, 'ytComments', true),
  settingsUpdatedAt: 1_700_000_000_000,
  siteAccess: { 'm.youtube.com': 'granted', 'www.youtube.com': 'not-granted' },
  pageHost: 'm.youtube.com',
};

const SYNC_RESPONSE_EXAMPLE = {
  ok: true,
  protocolVersion: PROTOCOL_VERSION,
  appVersion: '1.0',
  settings: withFeature(DEFAULT_SETTINGS, 'ytShorts', false),
  settingsUpdatedAt: 1_700_000_000_001,
};

const SYNC_REFUSAL_EXAMPLE = { ok: false, error: 'unsupported-protocol' };

/** What the app needs at run time; compiled into the Swift package as source. */
export function buildRuntimeContract() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    siteHosts: SITE_HOSTS,
    siteAccessValues: SITE_ACCESS_VALUES,
    contactReasons: CONTACT_REASONS,
    sites: SITES,
    topicModes: TOPIC_MODES,
    features: FEATURE_KEYS.map((key) => ({ key, ...FEATURES[key] })),
    topicPresets: TOPIC_PRESETS,
    defaults: DEFAULT_SETTINGS,
  };
}

/** What the Swift tests replay against their own code; never shipped in the app. */
export function buildTestContract() {
  return {
    generatedBy: GENERATED_BY,
    protocolVersion: PROTOCOL_VERSION,
    syncRequestExample: SYNC_REQUEST_EXAMPLE,
    syncResponseExample: SYNC_RESPONSE_EXAMPLE,
    syncRefusalExample: SYNC_REFUSAL_EXAMPLE,
    vectors: {
      parseSettings: RAW_SETTINGS_INPUTS.map(({ name, input }) => ({
        name,
        input,
        expected: parseSettings(input),
      })),
      normalizeList: NORMALIZE_LIST_INPUTS.map((input) => ({
        input,
        expected: normalizeList(input),
      })),
      sameTopicName: TOPIC_NAME_PAIRS.map(([a, b]) => ({ a, b, expected: sameTopicName(a, b) })),
      edits: EDIT_SEQUENCES.map(({ name, operations }) => ({
        name,
        operations,
        expected: operations.reduce(apply, DEFAULT_SETTINGS),
      })),
    },
  };
}

const GENERATED_BY =
  'pnpm ios:contract - generated from src/native/contract.ts, do not edit by hand';

/**
 * The runtime contract as a Swift source file. Compiled in rather than bundled
 * as a resource, so the app and its Safari extension both have it without
 * depending on how Xcode places package resource bundles.
 */
export function renderSwiftContract(): string {
  const json = JSON.stringify(buildRuntimeContract(), null, 2);
  if (json.includes('"""#')) throw new Error('The contract cannot be embedded as a raw string.');
  return `// ${GENERATED_BY}

/// The extension's catalog of switches, topics and defaults, as JSON.
enum ContractData {
    static let json = #"""
${json}
"""#
}
`;
}
