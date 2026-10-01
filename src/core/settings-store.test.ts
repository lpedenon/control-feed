import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, withFeature } from './settings';
import { loadSettings, loadSettingsUpdatedAt, saveSettings, watchSettings } from './settings-store';

beforeEach(() => {
  fakeBrowser.reset();
});

describe('settings store', () => {
  it('loads defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    const settings = withFeature(DEFAULT_SETTINGS, 'ytComments', true);
    await saveSettings(settings);
    expect(await loadSettings()).toEqual(settings);
  });

  it('repairs corrupt stored data', async () => {
    await fakeBrowser.storage.local.set({ settings: { features: { ytShorts: 'maybe' } } });
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('notifies watchers with validated settings', async () => {
    const onChange = vi.fn();
    const unwatch = watchSettings(onChange);
    await saveSettings(withFeature(DEFAULT_SETTINGS, 'ytShorts', false));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall?.[0].features.ytShorts).toBe(false);
    unwatch();
  });

  it('stamps each save with the time of the change', async () => {
    expect(await loadSettingsUpdatedAt()).toBe(0);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    await saveSettings(DEFAULT_SETTINGS);
    expect(await loadSettingsUpdatedAt()).toBe(1_700_000_000_000);
  });

  it('keeps a given stamp so settings received from elsewhere do not look new', async () => {
    await saveSettings(DEFAULT_SETTINGS, 42);
    expect(await loadSettingsUpdatedAt()).toBe(42);
  });

  it('ignores an unusable stamp', async () => {
    await fakeBrowser.storage.local.set({ settingsUpdatedAt: 'yesterday' });
    expect(await loadSettingsUpdatedAt()).toBe(0);
    await fakeBrowser.storage.local.set({ settingsUpdatedAt: -5 });
    expect(await loadSettingsUpdatedAt()).toBe(0);
  });
});
