import { storage } from 'wxt/utils/storage';
import { parseSettings, type Settings } from './settings';

/**
 * Stored as raw JSON and validated on every read, so settings written by an
 * older version or edited by hand can never crash a content script.
 */
const settingsItem = storage.defineItem<unknown>('local:settings');

/**
 * When the settings last changed, in milliseconds. Where the settings are
 * shared with another copy of themselves (the iOS app), the later change wins.
 */
const updatedAtItem = storage.defineItem<unknown>('local:settingsUpdatedAt');

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await settingsItem.getValue());
}

/** Zero when the settings were never changed or the stored stamp is unusable. */
export async function loadSettingsUpdatedAt(): Promise<number> {
  const value = await updatedAtItem.getValue();
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Both are written in one storage call, so they can never disagree after a crash. */
export async function saveSettings(
  settings: Settings,
  updatedAt: number = Date.now(),
): Promise<void> {
  await storage.setItems([
    { item: settingsItem, value: settings },
    { item: updatedAtItem, value: updatedAt },
  ]);
}

/** Calls `onChange` with validated settings whenever they change in any tab. */
export function watchSettings(onChange: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => onChange(parseSettings(value)));
}
