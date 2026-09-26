import { afterEach, describe, expect, it } from 'vitest';
import { createStyleInjector } from './style-injector';

afterEach(() => {
  document.getElementById('cf-test')?.remove();
});

describe('createStyleInjector', () => {
  it('attaches one style element and updates its text', () => {
    const injector = createStyleInjector(document, 'cf-test');
    injector.update('a { color: red; }', 'default');
    injector.update('b { color: blue; }', 'stored');
    const styles = document.querySelectorAll('#cf-test');
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe('b { color: blue; }');
    expect(styles[0]?.getAttribute('data-settings')).toBe('stored');
  });

  it('re-attaches when the page removed it', () => {
    const injector = createStyleInjector(document, 'cf-test');
    injector.update('a {}', 'default');
    document.getElementById('cf-test')?.remove();
    injector.update('a {}', 'default');
    expect(document.getElementById('cf-test')).not.toBeNull();
  });

  it('removes itself', () => {
    const injector = createStyleInjector(document, 'cf-test');
    injector.update('a {}', 'default');
    injector.remove();
    expect(document.getElementById('cf-test')).toBeNull();
  });
});
