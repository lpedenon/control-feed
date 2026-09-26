import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HIDDEN_ATTRIBUTE } from './stylesheet';
import { startTileFilter, type TileFilter, type TileSource } from './tile-filter';

interface FakeInfo {
  readonly title: string;
}

const source: TileSource<FakeInfo> = {
  candidateSelector: '.tile, .inner',
  resolveTile: (element) => element.closest('.tile') ?? element.closest('.inner'),
  describe: (tile) => {
    const title = tile.querySelector('.title')?.textContent?.trim();
    return title ? { title } : null;
  },
};

const hideBad = (info: FakeInfo | null) => (info?.title.includes('bad') ? 'keyword' : null);

function tile(id: string, title: string | null): string {
  const titleHtml = title === null ? '' : `<span class="title">${title}</span>`;
  return `<div class="tile" id="${id}"><div class="inner">${titleHtml}</div></div>`;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const hiddenReason = (id: string) =>
  document.getElementById(id)?.getAttribute(HIDDEN_ATTRIBUTE) ?? null;

let filter: TileFilter<FakeInfo> | undefined;

beforeEach(() => {
  document.body.innerHTML = `<main id="feed">${tile('a', 'good video')}${tile('b', 'bad video')}</main>`;
});

afterEach(() => {
  filter?.stop();
  filter = undefined;
  document.body.innerHTML = '';
});

describe('startTileFilter', () => {
  it('marks matching tiles already on the page with the reason', () => {
    filter = startTileFilter(document.documentElement, source, hideBad);
    expect(hiddenReason('a')).toBeNull();
    expect(hiddenReason('b')).toBe('keyword');
  });

  it('marks the outermost tile, not a nested candidate', () => {
    filter = startTileFilter(document.documentElement, source, hideBad);
    expect(document.querySelector(`#b .inner`)?.hasAttribute(HIDDEN_ATTRIBUTE)).toBe(false);
  });

  it('evaluates tiles added later', async () => {
    filter = startTileFilter(document.documentElement, source, hideBad);
    document.getElementById('feed')?.insertAdjacentHTML('beforeend', tile('c', 'another bad one'));
    await flush();
    expect(hiddenReason('c')).toBe('keyword');
  });

  it('re-evaluates a tile when its content arrives or changes', async () => {
    document.getElementById('feed')?.insertAdjacentHTML('beforeend', tile('c', null));
    filter = startTileFilter(document.documentElement, source, hideBad);
    expect(hiddenReason('c')).toBeNull();

    document
      .querySelector('#c .inner')
      ?.insertAdjacentHTML('beforeend', '<span class="title">bad</span>');
    await flush();
    expect(hiddenReason('c')).toBe('keyword');

    const title = document.querySelector('#c .title');
    if (title?.firstChild) title.firstChild.textContent = 'good now';
    await flush();
    expect(hiddenReason('c')).toBeNull();
  });

  it('lets the decider hide tiles that have not loaded yet', () => {
    document.getElementById('feed')?.insertAdjacentHTML('beforeend', tile('c', null));
    filter = startTileFilter(document.documentElement, source, (info) =>
      info === null ? 'unknown' : null,
    );
    expect(hiddenReason('c')).toBe('unknown');
    expect(hiddenReason('a')).toBeNull();
  });

  it('re-evaluates everything when the decider changes', () => {
    filter = startTileFilter(document.documentElement, source, hideBad);
    filter.setDecider((info) => (info?.title.includes('good') ? 'channel' : null));
    expect(hiddenReason('a')).toBe('channel');
    expect(hiddenReason('b')).toBeNull();
  });

  it('clears every mark and stops watching when the decider is removed', async () => {
    filter = startTileFilter(document.documentElement, source, hideBad);
    filter.setDecider(null);
    expect(hiddenReason('b')).toBeNull();

    document.getElementById('feed')?.insertAdjacentHTML('beforeend', tile('c', 'bad'));
    await flush();
    expect(hiddenReason('c')).toBeNull();
  });

  it('can start without a decider and pick one up later', () => {
    filter = startTileFilter(document.documentElement, source, null);
    expect(hiddenReason('b')).toBeNull();
    filter.setDecider(hideBad);
    expect(hiddenReason('b')).toBe('keyword');
  });

  it('stops processing after stop()', async () => {
    filter = startTileFilter(document.documentElement, source, hideBad);
    filter.stop();
    document.getElementById('feed')?.insertAdjacentHTML('beforeend', tile('c', 'bad'));
    await flush();
    expect(hiddenReason('c')).toBeNull();
    expect(hiddenReason('b')).toBeNull();
  });

  it('rescan() re-evaluates when outside context changed', () => {
    let blockWord = 'bad';
    filter = startTileFilter(document.documentElement, source, (info) =>
      info?.title.includes(blockWord) ? 'keyword' : null,
    );
    blockWord = 'good';
    filter.rescan();
    expect(hiddenReason('a')).toBe('keyword');
    expect(hiddenReason('b')).toBeNull();
  });
});
