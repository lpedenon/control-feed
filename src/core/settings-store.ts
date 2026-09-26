import { storage } from 'wxt/utils/storage';
import { parseSettings, type Settings } from './settings';

/**
 * Stored as raw JSON and validated on every read, so settings written by an
 * older version or edited by hand can never crash a content script.
 */
const settingsItem = storage.defineItem<unknown>('local:settings');

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsItem.setValue(settings);
}

/** Calls `onChange` with validated settings whenever they change in any tab. */
export function watchSettings(onChange: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => onChange(parseSettings(value)));
}
