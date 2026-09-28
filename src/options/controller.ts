import {
  type Settings,
  settingsEqual,
  withFeature,
  withSite,
  withTopicAdded,
  withTopicKeywords,
  withTopicRemoved,
  withYoutubeFilters,
} from '../core/settings';
import { createOptionsView, type OptionsView } from './view';

export interface SettingsStore {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
  watch(onChange: (settings: Settings) => void): () => void;
}

/** How long typing in a list pauses before it is saved. */
export const LIST_SAVE_DELAY_MS = 400;

type Edit = (settings: Settings) => Settings;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Wires the options view to storage. Unsaved edits are kept as a list of
 * changes rather than a snapshot and replayed on top of the latest stored
 * settings, so a change made in another tab meanwhile is never overwritten.
 * Switches save at once; list edits after a short pause.
 */
export async function startOptions(root: HTMLElement, store: SettingsStore): Promise<() => void> {
  let stored = await store.load();
  let pending: readonly Edit[] = [];
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let view: OptionsView | undefined;

  const current = (): Settings => pending.reduce((settings, edit) => edit(settings), stored);

  const save = async () => {
    saveTimer = undefined;
    const next = current();
    pending = [];
    // Recorded before writing so the storage echo of this save is recognized.
    stored = next;
    view?.setStatus('saving', 'Saving…');
    try {
      await store.save(next);
      view?.setStatus('saved', 'Saved. Open tabs update right away.');
    } catch (error) {
      console.error('[Control Feed] Saving settings failed.', error);
      view?.setStatus('error', `Could not save your changes: ${describeError(error)}`);
    }
  };

  const change = (edit: Edit, delayMs = 0) => {
    pending = [...pending, edit];
    view?.update(current());
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void save(), delayMs);
  };

  view = createOptionsView(root, {
    onSiteToggle: (site, enabled) => change((s) => withSite(s, site, enabled)),
    onFeatureToggle: (key, enabled) => change((s) => withFeature(s, key, enabled)),
    onOnlyAllowedToggle: (enabled) =>
      change((s) => withYoutubeFilters(s, { onlyAllowedChannels: enabled })),
    onListChange: (field, lines) =>
      change((s) => withYoutubeFilters(s, { [field]: lines }), LIST_SAVE_DELAY_MS),
    onTopicModeChange: (topicMode) => change((s) => withYoutubeFilters(s, { topicMode })),
    onTopicAdd: (name) => change((s) => withTopicAdded(s, name)),
    onTopicRemove: (name) => change((s) => withTopicRemoved(s, name)),
    onTopicKeywordsChange: (name, lines) =>
      change((s) => withTopicKeywords(s, name, lines), LIST_SAVE_DELAY_MS),
  });
  view.update(current());

  const unwatch = store.watch((external) => {
    if (settingsEqual(external, stored)) return;
    stored = external;
    view?.update(current());
  });

  return () => {
    unwatch();
    if (saveTimer !== undefined) {
      clearTimeout(saveTimer);
      void save();
    }
  };
}
