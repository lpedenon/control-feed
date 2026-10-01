import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_ROOT = join(import.meta.dirname, '..', '..', 'e2e', 'fixtures');

const cache = new Map<string, string>();

/** Parses a captured page snapshot (see e2e/tools) into a fresh Document. */
export function loadFixture(
  site: 'youtube' | 'youtube-mobile' | 'instagram',
  name: string,
): Document {
  const path = join(FIXTURE_ROOT, site, `${name}.html`);
  let html = cache.get(path);
  if (html === undefined) {
    html = readFileSync(path, 'utf8');
    cache.set(path, html);
  }
  return new DOMParser().parseFromString(html, 'text/html');
}
