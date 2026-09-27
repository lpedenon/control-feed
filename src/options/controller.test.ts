import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  type Settings,
  withFeature,
  withTopicAdded,
  withYoutubeFilters,
} from '../core/settings';
import { findPreset } from '../core/topics';
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

  it('marks unfinished sites with a note linking to the details', async () => {
    const { store } = fakeStore(DEFAULT_SETTINGS);
    stop = await startOptions(root, store);
    const instagram = input('site-instagram').closest('section');
    const note = instagram?.querySelector('.site-note');
    expect(note?.textContent).toContain('Unfinished');
    expect(note?.querySelector('a')?.getAttribute('href')).toBe(
      'https://github.com/lpedenon/control-feed/issues/2',
    );
    expect(input('site-youtube').closest('section')?.querySelector('.site-note')).toBeNull();
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
    const warning = document.getElementById('allowlist-warning') as HTMLElement;
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

  describe('topics', () => {
    function addTopic(name: string): void {
      input('topic-name').value = name;
      input('topic-name').form?.requestSubmit();
    }

    function topicArea(name: string): HTMLTextAreaElement {
      const label = [...root.querySelectorAll<HTMLLabelElement>('.topic label')].find(
        (candidate) => candidate.textContent === name,
      );
      return document.getElementById(label?.htmlFor ?? '') as HTMLTextAreaElement;
    }

    it('saves the chosen mode right away', async () => {
      const fake = fakeStore(DEFAULT_SETTINGS);
      stop = await startOptions(root, fake.store);
      expect(input('topic-mode-off').checked).toBe(true);
      click('topic-mode-block');
      await vi.runAllTimersAsync();
      expect(fake.stored().youtubeFilters.topicMode).toBe('block');
      expect(input('topic-mode-off').checked).toBe(false);
    });

    it('adds a built-in topic with its words and offers only the rest', async () => {
      const fake = fakeStore(DEFAULT_SETTINGS);
      stop = await startOptions(root, fake.store);
      const offered = () =>
        [...root.querySelectorAll('#topic-presets option')].map((o) => o.getAttribute('value'));
      expect(offered()).toContain('AI');
      addTopic('ai');
      expect(input('topic-name').value).toBe('');
      expect(topicArea('AI').value).toBe(findPreset('AI')?.keywords.join('\n'));
      expect(offered()).not.toContain('AI');
      await vi.runAllTimersAsync();
      expect(fake.stored().youtubeFilters.topics).toEqual([findPreset('AI')]);
    });

    it('saves edited words after a pause and keeps the text being typed', async () => {
      const fake = fakeStore(withTopicAdded(DEFAULT_SETTINGS, 'Chess'));
      stop = await startOptions(root, fake.store);
      const words = topicArea('Chess');
      words.focus();
      words.value = 'chess\n  opening ';
      words.dispatchEvent(new Event('input'));
      expect(topicArea('Chess')).toBe(words);
      expect(words.value).toBe('chess\n  opening ');
      await vi.advanceTimersByTimeAsync(LIST_SAVE_DELAY_MS);
      expect(fake.stored().youtubeFilters.topics).toEqual([
        { name: 'Chess', keywords: ['chess', 'opening'] },
      ]);
      words.blur();
      expect(words.value).toBe('chess\nopening');
    });

    it('removes a topic', async () => {
      const fake = fakeStore(withTopicAdded(withTopicAdded(DEFAULT_SETTINGS, 'Chess'), 'Go'));
      stop = await startOptions(root, fake.store);
      const remove = root.querySelector<HTMLButtonElement>('[aria-label="Remove the topic Chess"]');
      remove?.click();
      expect(root.querySelectorAll('.topic')).toHaveLength(1);
      await vi.runAllTimersAsync();
      expect(fake.stored().youtubeFilters.topics.map((topic) => topic.name)).toEqual(['Go']);
    });

    it('keeps typing focus when another tab removes a topic above', async () => {
      const both = withTopicAdded(withTopicAdded(DEFAULT_SETTINGS, 'Chess'), 'Go');
      const fake = fakeStore(both);
      stop = await startOptions(root, fake.store);
      const words = topicArea('Go');
      words.focus();
      fake.pushExternal(withTopicAdded(DEFAULT_SETTINGS, 'Go'));
      expect(root.querySelectorAll('.topic')).toHaveLength(1);
      expect(document.activeElement).toBe(words);
    });

    it('warns when only topics are wanted but none have words', async () => {
      const fake = fakeStore(DEFAULT_SETTINGS);
      stop = await startOptions(root, fake.store);
      const warning = document.getElementById('topics-warning') as HTMLElement;
      expect(warning.hidden).toBe(true);
      click('topic-mode-only');
      expect(warning.hidden).toBe(false);
      addTopic('Chess');
      expect(warning.hidden).toBe(true);
    });

    it('shows topics added in another tab', async () => {
      const fake = fakeStore(DEFAULT_SETTINGS);
      stop = await startOptions(root, fake.store);
      fake.pushExternal(
        withYoutubeFilters(withTopicAdded(DEFAULT_SETTINGS, 'Gaming'), { topicMode: 'block' }),
      );
      expect(input('topic-mode-block').checked).toBe(true);
      expect(topicArea('Gaming').value).toContain('Minecraft');
    });
  });
});
