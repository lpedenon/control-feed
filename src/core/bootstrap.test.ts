import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { runSite } from './bootstrap';
import { DEFAULT_SETTINGS, withFeature } from './settings';
import * as store from './settings-store';
import type { SiteDefinition } from './site-runner';
import * as runnerModule from './site-runner';

vi.mock('./settings-store');
vi.mock('./site-runner');

const definition = {} as SiteDefinition<unknown>;

function fakeContext() {
  const callbacks: (() => void)[] = [];
  const ctx = { onInvalidated: (callback: () => void) => callbacks.push(callback) };
  return {
    ctx: ctx as unknown as ContentScriptContext,
    invalidate: () => {
      for (const callback of callbacks) callback();
    },
  };
}

function fakeRunner() {
  const runner = { apply: vi.fn(), stop: vi.fn() };
  vi.mocked(runnerModule.startSite).mockReturnValue(runner);
  return runner;
}

function fakeWatch() {
  const state: { callback?: (settings: typeof DEFAULT_SETTINGS) => void; stopped: boolean } = {
    stopped: false,
  };
  vi.mocked(store.watchSettings).mockImplementation((callback) => {
    state.callback = callback;
    return () => {
      state.stopped = true;
    };
  });
  return state;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('runSite', () => {
  it('applies the stored settings', async () => {
    const runner = fakeRunner();
    fakeWatch();
    const stored = withFeature(DEFAULT_SETTINGS, 'ytComments', true);
    vi.mocked(store.loadSettings).mockResolvedValue(stored);
    await runSite(fakeContext().ctx, definition);
    expect(runner.apply).toHaveBeenCalledExactlyOnceWith(stored);
  });

  it('follows later changes', async () => {
    const runner = fakeRunner();
    const watch = fakeWatch();
    vi.mocked(store.loadSettings).mockResolvedValue(DEFAULT_SETTINGS);
    await runSite(fakeContext().ctx, definition);
    const changed = withFeature(DEFAULT_SETTINGS, 'ytShorts', false);
    watch.callback?.(changed);
    expect(runner.apply).toHaveBeenLastCalledWith(changed);
  });

  it('watches before it reads, and lets a change that arrives while reading win', async () => {
    const runner = fakeRunner();
    const watch = fakeWatch();
    let finishRead: (value: typeof DEFAULT_SETTINGS) => void = () => {};
    vi.mocked(store.loadSettings).mockImplementation(
      () =>
        new Promise((resolve) => {
          expect(watch.callback).toBeDefined();
          finishRead = resolve;
        }),
    );
    const running = runSite(fakeContext().ctx, definition);

    const newer = withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false);
    watch.callback?.(newer);
    finishRead(DEFAULT_SETTINGS);
    await running;

    expect(runner.apply).toHaveBeenCalledExactlyOnceWith(newer);
  });

  it('falls back on the defaults when the settings cannot be read', async () => {
    const runner = fakeRunner();
    fakeWatch();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(store.loadSettings).mockRejectedValue(new Error('storage is gone'));
    await runSite(fakeContext().ctx, definition);
    expect(runner.apply).toHaveBeenCalledExactlyOnceWith(DEFAULT_SETTINGS);
  });

  it('stops the runner and the watcher when the script is invalidated', async () => {
    const runner = fakeRunner();
    const watch = fakeWatch();
    vi.mocked(store.loadSettings).mockResolvedValue(DEFAULT_SETTINGS);
    const { ctx, invalidate } = fakeContext();
    await runSite(ctx, definition);
    invalidate();
    expect(runner.stop).toHaveBeenCalled();
    expect(watch.stopped).toBe(true);
  });
});
