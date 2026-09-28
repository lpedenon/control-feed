import {
  FEATURES,
  type FeatureDefinition,
  type FeatureKey,
  featureKeysForSite,
  SITE_LABELS,
  SITE_NOTES,
  SITES,
  type Site,
} from '../core/features';
import type { Settings, YoutubeFilters } from '../core/settings';
import { sameTopicName, TOPIC_PRESETS, type Topic, type TopicMode } from '../core/topics';
import { el } from './dom';

export type ListField = 'allowedChannels' | 'blockedChannels' | 'blockedKeywords';

export interface OptionsHandlers {
  onSiteToggle(site: Site, enabled: boolean): void;
  onFeatureToggle(key: FeatureKey, enabled: boolean): void;
  onOnlyAllowedToggle(enabled: boolean): void;
  onListChange(field: ListField, lines: readonly string[]): void;
  onTopicModeChange(mode: TopicMode): void;
  onTopicAdd(name: string): void;
  onTopicRemove(name: string): void;
  onTopicKeywordsChange(name: string, lines: readonly string[]): void;
}

export type StatusTone = 'idle' | 'saving' | 'saved' | 'error';

export interface OptionsView {
  /** Syncs every control to `settings`, leaving a list the user is typing in alone. */
  update(settings: Settings): void;
  setStatus(tone: StatusTone, text: string): void;
}

interface ListDefinition {
  readonly field: ListField;
  readonly label: string;
  readonly hint: string;
  readonly placeholder: string;
}

const LISTS: readonly ListDefinition[] = [
  {
    field: 'allowedChannels',
    label: 'Allowed channels',
    hint: 'One per line: the name shown on YouTube, an @handle or a channel link. Their videos are never hidden by blocked words.',
    placeholder: '3Blue1Brown\n@mitocw',
  },
  {
    field: 'blockedChannels',
    label: 'Blocked channels',
    hint: 'Never shown anywhere on YouTube.',
    placeholder: 'Channel name\n@handle',
  },
  {
    field: 'blockedKeywords',
    label: 'Blocked words in titles',
    hint: 'Hides videos whose title contains any of these words or phrases, in any capitalization.',
    placeholder: 'prank\nreaction\nyou won’t believe',
  },
];

interface TopicModeDefinition {
  readonly mode: TopicMode;
  readonly label: string;
  readonly description: string;
}

const TOPIC_MODE_CHOICES: readonly TopicModeDefinition[] = [
  { mode: 'off', label: 'Off', description: 'Topics below are kept but not used.' },
  {
    mode: 'only',
    label: 'Only show videos about these topics',
    description:
      'Everything else is hidden: on the home page, in search, next to videos and on channel pages.',
  },
  {
    mode: 'block',
    label: 'Hide videos about these topics',
    description: 'They never show anywhere on YouTube.',
  },
];

interface TopicCard {
  readonly element: HTMLElement;
  readonly area: HTMLTextAreaElement;
}

function switchInput(doc: Document, id: string, describedBy?: string): HTMLInputElement {
  return el(doc, 'input', {
    className: 'switch',
    attrs: {
      type: 'checkbox',
      role: 'switch',
      id,
      ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    },
  });
}

function switchRow(
  doc: Document,
  id: string,
  label: string,
  description: string | undefined,
  onChange: (checked: boolean) => void,
): { row: HTMLElement; input: HTMLInputElement } {
  const descriptionId = description ? `${id}-description` : undefined;
  const input = switchInput(doc, id, descriptionId);
  input.addEventListener('change', () => onChange(input.checked));
  const row = el(doc, 'label', { className: 'row', attrs: { for: id } }, [
    el(doc, 'span', { className: 'row-text' }, [
      el(doc, 'span', { className: 'row-label', text: label }),
      description &&
        el(doc, 'span', {
          className: 'row-description',
          text: description,
          attrs: { id: descriptionId ?? '' },
        }),
    ]),
    input,
  ]);
  return { row, input };
}

function groupsOf(site: Site): ReadonlyMap<string, readonly FeatureKey[]> {
  const groups = new Map<string, FeatureKey[]>();
  for (const key of featureKeysForSite(site)) {
    const group = FEATURES[key].group;
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  return groups;
}

export function createOptionsView(root: HTMLElement, handlers: OptionsHandlers): OptionsView {
  const doc = root.ownerDocument;
  const siteSections = new Map<Site, HTMLElement>();
  const siteSwitches = new Map<Site, HTMLInputElement>();
  const siteStates = new Map<Site, HTMLElement>();
  const featureSwitches = new Map<FeatureKey, HTMLInputElement>();
  const listAreas = new Map<ListField, HTMLTextAreaElement>();
  let current: Settings | null = null;

  const onlyAllowed = switchRow(
    doc,
    'only-allowed',
    'Only show videos from allowed channels',
    'Everything else is hidden: on the home page, in search, next to videos and on channel pages.',
    (checked) => handlers.onOnlyAllowedToggle(checked),
  );
  const emptyAllowlistWarning = el(doc, 'p', {
    className: 'warning',
    text: 'Add at least one allowed channel, or no videos will show.',
    attrs: { id: 'allowlist-warning', hidden: '' },
  });

  const topicModeInputs = new Map<TopicMode, HTMLInputElement>();
  const topicCards = new Map<string, TopicCard>();
  const topicList = el(doc, 'div', { className: 'topics' });
  const presetOptions = el(doc, 'datalist', { attrs: { id: 'topic-presets' } });
  const emptyTopicsWarning = el(doc, 'p', {
    className: 'warning',
    text: 'Add a topic and give it at least one word, or no videos will show.',
    attrs: { id: 'topics-warning', hidden: '' },
  });
  let topicCardCount = 0;

  function topicModeRow(choice: TopicModeDefinition): HTMLElement {
    const id = `topic-mode-${choice.mode}`;
    const input = el(doc, 'input', {
      className: 'radio',
      attrs: {
        type: 'radio',
        name: 'topic-mode',
        id,
        value: choice.mode,
        'aria-describedby': `${id}-description`,
      },
    });
    input.addEventListener('change', () => {
      if (input.checked) handlers.onTopicModeChange(choice.mode);
    });
    topicModeInputs.set(choice.mode, input);
    return el(doc, 'label', { className: 'row', attrs: { for: id } }, [
      el(doc, 'span', { className: 'row-text' }, [
        el(doc, 'span', { className: 'row-label', text: choice.label }),
        el(doc, 'span', {
          className: 'row-description',
          text: choice.description,
          attrs: { id: `${id}-description` },
        }),
      ]),
      input,
    ]);
  }

  function topicCard(topic: Topic): TopicCard {
    topicCardCount += 1;
    const id = `topic-${topicCardCount}`;
    const area = el(doc, 'textarea', {
      attrs: {
        id,
        rows: '3',
        spellcheck: 'false',
        autocomplete: 'off',
        placeholder: 'One word or phrase per line',
        'aria-describedby': `${id}-hint`,
      },
    });
    area.addEventListener('input', () =>
      handlers.onTopicKeywordsChange(topic.name, area.value.split('\n')),
    );
    area.addEventListener('blur', () => {
      const stored = current?.youtubeFilters.topics.find((t) => sameTopicName(t.name, topic.name));
      if (stored) area.value = stored.keywords.join('\n');
    });
    const remove = el(doc, 'button', {
      className: 'remove',
      text: 'Remove',
      attrs: { type: 'button', 'aria-label': `Remove the topic ${topic.name}` },
    });
    remove.addEventListener('click', () => handlers.onTopicRemove(topic.name));
    const element = el(doc, 'div', { className: 'field topic' }, [
      el(doc, 'div', { className: 'topic-header' }, [
        el(doc, 'label', { className: 'field-label', text: topic.name, attrs: { for: id } }),
        remove,
      ]),
      el(doc, 'p', {
        className: 'field-hint',
        text: 'Videos whose title contains any of these words count as this topic.',
        attrs: { id: `${id}-hint` },
      }),
      area,
    ]);
    return { element, area };
  }

  function topicsGroup(): HTMLElement {
    const nameInput = el(doc, 'input', {
      attrs: {
        type: 'text',
        id: 'topic-name',
        list: presetOptions.id,
        autocomplete: 'off',
        placeholder: 'AI, Gaming, Chess…',
        'aria-describedby': 'topic-name-hint',
      },
    });
    const form = el(doc, 'form', { className: 'field add-topic' }, [
      el(doc, 'label', {
        className: 'field-label',
        text: 'Add a topic',
        attrs: { for: nameInput.id },
      }),
      el(doc, 'p', {
        className: 'field-hint',
        text: 'Pick a common topic to start with its words, or type your own.',
        attrs: { id: 'topic-name-hint' },
      }),
      el(doc, 'div', { className: 'add-topic-row' }, [
        nameInput,
        el(doc, 'button', { className: 'add', text: 'Add', attrs: { type: 'submit' } }),
      ]),
      presetOptions,
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (nameInput.value.trim() === '') return;
      handlers.onTopicAdd(nameInput.value);
      nameInput.value = '';
    });

    return el(doc, 'div', { className: 'group' }, [
      el(doc, 'h3', { className: 'group-title', text: 'Topics' }),
      el(doc, 'div', { attrs: { role: 'radiogroup', 'aria-label': 'Topic filter' } }, [
        ...TOPIC_MODE_CHOICES.map(topicModeRow),
      ]),
      emptyTopicsWarning,
      topicList,
      form,
    ]);
  }

  function listField(definition: ListDefinition): HTMLElement {
    const hintId = `${definition.field}-hint`;
    const area = el(doc, 'textarea', {
      attrs: {
        id: definition.field,
        rows: '4',
        spellcheck: 'false',
        autocomplete: 'off',
        placeholder: definition.placeholder,
        'aria-describedby': hintId,
      },
    });
    area.addEventListener('input', () =>
      handlers.onListChange(definition.field, area.value.split('\n')),
    );
    // Show the cleaned-up list once the user is done editing.
    area.addEventListener('blur', () => {
      if (current) area.value = current.youtubeFilters[definition.field].join('\n');
    });
    listAreas.set(definition.field, area);
    return el(doc, 'div', { className: 'field' }, [
      el(doc, 'label', {
        className: 'field-label',
        text: definition.label,
        attrs: { for: area.id },
      }),
      el(doc, 'p', { className: 'field-hint', text: definition.hint, attrs: { id: hintId } }),
      area,
    ]);
  }

  function siteSection(site: Site): HTMLElement {
    const titleId = `site-${site}-title`;
    const toggle = switchInput(doc, `site-${site}`);
    toggle.setAttribute('aria-labelledby', titleId);
    toggle.addEventListener('change', () => handlers.onSiteToggle(site, toggle.checked));
    siteSwitches.set(site, toggle);
    const state = el(doc, 'span', { className: 'site-state', attrs: { 'aria-hidden': 'true' } });
    siteStates.set(site, state);

    const groups = [...groupsOf(site)].map(([name, keys]) =>
      el(doc, 'div', { className: 'group' }, [
        el(doc, 'h3', { className: 'group-title', text: name }),
        ...keys.map((key) => {
          const feature: FeatureDefinition = FEATURES[key];
          const { row, input } = switchRow(
            doc,
            `feature-${key}`,
            feature.label,
            feature.description,
            (checked) => handlers.onFeatureToggle(key, checked),
          );
          featureSwitches.set(key, input);
          return row;
        }),
      ]),
    );

    const filters =
      site === 'youtube'
        ? el(doc, 'div', { className: 'group' }, [
            el(doc, 'h3', { className: 'group-title', text: 'Channels and words' }),
            onlyAllowed.row,
            emptyAllowlistWarning,
            ...LISTS.map(listField),
          ])
        : null;

    const note = SITE_NOTES[site];
    const section = el(
      doc,
      'section',
      { className: 'site', attrs: { 'aria-labelledby': titleId } },
      [
        el(doc, 'header', { className: 'site-header' }, [
          el(doc, 'h2', { text: SITE_LABELS[site], attrs: { id: titleId } }),
          el(doc, 'label', { className: 'site-toggle', attrs: { for: toggle.id } }, [
            state,
            toggle,
          ]),
        ]),
        note &&
          el(doc, 'p', { className: 'site-note' }, [
            `${note.text} `,
            el(doc, 'a', {
              text: note.link.label,
              attrs: { href: note.link.url, target: '_blank', rel: 'noopener noreferrer' },
            }),
          ]),
        el(doc, 'div', { className: 'site-body' }, [
          ...groups,
          site === 'youtube' && topicsGroup(),
          filters,
        ]),
      ],
    );
    siteSections.set(site, section);
    return section;
  }

  const status = el(doc, 'p', {
    className: 'status',
    attrs: { role: 'status', 'aria-live': 'polite', 'data-tone': 'idle' },
  });

  root.replaceChildren(...SITES.map(siteSection), status);

  function updateTopics(filters: YoutubeFilters): void {
    for (const [mode, input] of topicModeInputs) input.checked = filters.topicMode === mode;
    emptyTopicsWarning.hidden = !(
      filters.topicMode === 'only' && filters.topics.every((topic) => topic.keywords.length === 0)
    );

    // Cards are kept by name so the one being typed in keeps its focus.
    const cards = filters.topics.map((topic) => {
      const key = topic.name.toLocaleLowerCase();
      let card = topicCards.get(key);
      if (!card) {
        card = topicCard(topic);
        topicCards.set(key, card);
      }
      if (doc.activeElement !== card.area) card.area.value = topic.keywords.join('\n');
      return [key, card] as const;
    });
    for (const key of topicCards.keys()) {
      if (!cards.some(([kept]) => kept === key)) topicCards.delete(key);
    }
    // Only cards out of place move; moving an element takes its focus away.
    const elements = cards.map(([, card]) => card.element);
    for (const child of [...topicList.children]) {
      if (!elements.includes(child as HTMLElement)) child.remove();
    }
    elements.forEach((element, index) => {
      if (topicList.children[index] !== element) {
        topicList.insertBefore(element, topicList.children[index] ?? null);
      }
    });

    const offered = TOPIC_PRESETS.filter(
      (preset) => !filters.topics.some((topic) => sameTopicName(topic.name, preset.name)),
    ).map((preset) => preset.name);
    if (
      offered.join('\n') !==
      [...presetOptions.children].map((o) => o.getAttribute('value')).join('\n')
    ) {
      presetOptions.replaceChildren(
        ...offered.map((name) => el(doc, 'option', { attrs: { value: name } })),
      );
    }
  }

  function updateFilters(filters: YoutubeFilters): void {
    updateTopics(filters);
    onlyAllowed.input.checked = filters.onlyAllowedChannels;
    emptyAllowlistWarning.hidden = !(
      filters.onlyAllowedChannels && filters.allowedChannels.length === 0
    );
    for (const [field, area] of listAreas) {
      if (doc.activeElement !== area) area.value = filters[field].join('\n');
    }
  }

  return {
    update(settings) {
      current = settings;
      for (const site of SITES) {
        const enabled = settings.sites[site];
        const toggle = siteSwitches.get(site);
        if (toggle) toggle.checked = enabled;
        siteSections.get(site)?.setAttribute('data-enabled', String(enabled));
        const state = siteStates.get(site);
        if (state) state.textContent = enabled ? 'On' : 'Off';
      }
      for (const [key, input] of featureSwitches) input.checked = settings.features[key];
      updateFilters(settings.youtubeFilters);
    },
    setStatus(tone, text) {
      status.dataset.tone = tone;
      status.textContent = text;
    },
  };
}
