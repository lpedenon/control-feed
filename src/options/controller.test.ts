import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings, withFeature } from '../core/settings';
import { LIST_SAVE_DELAY_MS, type SettingsStore, startOptions } from './controller';

function fakeStore(initial: Settings) {
  let stored = initial;
  const listeners = new Set<(settings: Settings) => void>();
  const store = {
    load: vi.fn(async () => stored),
    save: vi.fn(async (settings: Settings) => {
      stored = settings;
    }),
    watch: vi.fn((onChange: (settings: Settings) => void) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    }),
  } satisfies SettingsStore;
  const pushExternal = (settings: Settings) => {
    stored = settings;
    for (const listener of listeners) listener(settings);
  };
  return { store, pushExternal, stored: () => stored };
}

const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const area = (id: string) => document.getElementById(id) as HTMLTextAreaElement;

function click(id: string): void {
  input(id).click();
}

function type(id: string, value: string): void {
  const field = area(id);
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

let root: HTMLElement;
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  root = document.createElement('main');
  document.body.append(root);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  root.remove();
  vi.useRealTimers();
});

describe('startOptions', () => {
  it('shows the stored settings', async () => {
    const { store } = fakeStore(withFeature(DEFAULT_SETTINGS, 'ytComments', true));
    stop = await startOptions(root, store);
    expect(input('feature-ytComments').checked).toBe(true);
    expect(input('feature-ytShorts').checked).toBe(true);
    expect(input('site-youtube').checked).toBe(true);
    expect(input('only-allowed').checked).toBe(false);
  });

  it('saves a switch change right away', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    click('feature-ytShorts');
    await vi.runAllTimersAsync();
    expect(fake.stored().features.ytShorts).toBe(false);
    expect(root.querySelector('.status')?.textContent).toContain('Saved');
  });

  it('turns a whole site off and marks the section', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    click('site-instagram');
    await vi.runAllTimersAsync();
    expect(fake.stored().sites.instagram).toBe(false);
    const section = input('site-instagram').closest('section');
    expect(section?.getAttribute('data-enabled')).toBe('false');
    expect(section?.querySelector('.site-state')?.textContent).toBe('Off');
  });

  it('saves list edits after a pause, normalized, in one write', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    type('blockedKeywords', 'prank');
    type('blockedKeywords', 'prank\n reaction \nPRANK\n');
    await vi.advanceTimersByTimeAsync(LIST_SAVE_DELAY_MS - 1);
    expect(fake.store.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.store.save).toHaveBeenCalledTimes(1);
    expect(fake.stored().youtubeFilters.blockedKeywords).toEqual(['prank', 'reaction']);
  });

  it('keeps what the user is typing, then tidies it on blur', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    type('allowedChannels', '  3Blue1Brown\n\n');
    expect(area('allowedChannels').value).toBe('  3Blue1Brown\n\n');
    area('allowedChannels').blur();
    expect(area('allowedChannels').value).toBe('3Blue1Brown');
  });

  it('warns when only allowed channels are wanted but none are listed', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    const warning = root.querySelector('.warning') as HTMLElement;
    expect(warning.hidden).toBe(true);
    click('only-allowed');
    expect(warning.hidden).toBe(false);
    type('allowedChannels', '3Blue1Brown');
    expect(warning.hidden).toBe(true);
    await vi.runAllTimersAsync();
    expect(fake.stored().youtubeFilters).toMatchObject({
      onlyAllowedChannels: true,
      allowedChannels: ['3Blue1Brown'],
    });
  });

  it('reflects changes made in another tab', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    fake.pushExternal(withFeature(DEFAULT_SETTINGS, 'igReels', false));
    expect(input('feature-igReels').checked).toBe(false);
  });

  it('keeps a change made in another tab while a list edit is waiting to save', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    type('blockedKeywords', 'prank');
    fake.pushExternal(withFeature(DEFAULT_SETTINGS, 'ytComments', true));
    expect(input('feature-ytComments').checked).toBe(true);
    await vi.runAllTimersAsync();
    expect(fake.stored().features.ytComments).toBe(true);
    expect(fake.stored().youtubeFilters.blockedKeywords).toEqual(['prank']);
  });

  it('reports a failed save instead of pretending it worked', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    fake.store.save.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stop = await startOptions(root, fake.store);
    click('feature-ytShorts');
    await vi.runAllTimersAsync();
    const status = root.querySelector('.status') as HTMLElement;
    expect(status.dataset.tone).toBe('error');
    expect(status.textContent).toContain('QUOTA_BYTES');
  });

  it('flushes a pending list edit when closed', async () => {
    const fake = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, fake.store);
    type('blockedChannels', 'Drama Alert');
    stop();
    stop = undefined;
    await vi.runAllTimersAsync();
    expect(fake.stored().youtubeFilters.blockedChannels).toEqual(['Drama Alert']);
  });
});
