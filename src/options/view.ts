import {
  FEATURES,
  type FeatureDefinition,
  type FeatureKey,
  featureKeysForSite,
  SITE_LABELS,
  SITES,
  type Site,
} from '../core/features';
import type { Settings, YoutubeFilters } from '../core/settings';
import { el } from './dom';

export type ListField = 'allowedChannels' | 'blockedChannels' | 'blockedKeywords';

export interface OptionsHandlers {
  onSiteToggle(site: Site, enabled: boolean): void;
  onFeatureToggle(key: FeatureKey, enabled: boolean): void;
  onOnlyAllowedToggle(enabled: boolean): void;
  onListChange(field: ListField, lines: readonly string[]): void;
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
    attrs: { hidden: '' },
  });

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
        el(doc, 'div', { className: 'site-body' }, [...groups, filters]),
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

  function updateFilters(filters: YoutubeFilters): void {
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
