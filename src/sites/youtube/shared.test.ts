import { describe, expect, it } from 'vitest';
import { outermostMatch } from './shared';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('outermostMatch', () => {
  const doc = parse(`
    <div class="cell"><div class="tile"><span id="inner">x</span></div></div>
    <div class="tile"><div class="tile"><b id="deep">y</b></div></div>
    <p id="alone">z</p>`);

  it('returns the element itself when nothing wraps it', () => {
    const tile = doc.querySelector('.cell > .tile') as Element;
    expect(outermostMatch(tile, '.tile')).toBe(tile);
  });

  it('climbs from a descendant to the tile', () => {
    expect(outermostMatch(doc.getElementById('inner') as Element, '.tile')).toBe(
      doc.querySelector('.cell > .tile'),
    );
  });

  it('prefers the outermost of nested matches', () => {
    const outer = doc.querySelectorAll('.tile')[1];
    expect(outermostMatch(doc.getElementById('deep') as Element, '.tile')).toBe(outer);
  });

  it('returns null when nothing matches', () => {
    expect(outermostMatch(doc.getElementById('alone') as Element, '.tile')).toBeNull();
  });
});
