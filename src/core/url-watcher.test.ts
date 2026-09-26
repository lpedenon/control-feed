import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchUrl } from './url-watcher';

let stop: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.useRealTimers();
});

describe('watchUrl', () => {
  it('reports in-page navigation on the next poll', () => {
    const onChange = vi.fn();
    stop = watchUrl(window, onChange, { pollMs: 250 });
    window.history.pushState(null, '', '/shorts/abc');
    vi.advanceTimersByTime(250);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0].pathname).toBe('/shorts/abc');
  });

  it('reports immediately on popstate', () => {
    const onChange = vi.fn();
    stop = watchUrl(window, onChange);
    window.history.pushState(null, '', '/feed/trending');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports immediately on site-specific navigation events', () => {
    const onChange = vi.fn();
    stop = watchUrl(window, onChange, { documentEvents: ['yt-navigate-start'] });
    window.history.pushState(null, '', '/watch?v=1');
    document.dispatchEvent(new Event('yt-navigate-start'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports each change once', () => {
    const onChange = vi.fn();
    stop = watchUrl(window, onChange, { pollMs: 100 });
    window.history.pushState(null, '', '/a');
    window.dispatchEvent(new PopStateEvent('popstate'));
    vi.advanceTimersByTime(500);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stops reporting after the returned stop function runs', () => {
    const onChange = vi.fn();
    watchUrl(window, onChange, { pollMs: 100 })();
    window.history.pushState(null, '', '/b');
    window.dispatchEvent(new PopStateEvent('popstate'));
    vi.advanceTimersByTime(500);
    expect(onChange).not.toHaveBeenCalled();
  });
});
