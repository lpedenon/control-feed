import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, withFeature } from './settings';
import { loadSettings, saveSettings, watchSettings } from './settings-store';

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
});
