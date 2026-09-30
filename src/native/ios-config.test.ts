import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('iOS project configuration', () => {
  it('has the same version as the extension', () => {
    const { version } = JSON.parse(read('package.json')) as { version: string };
    expect(read('ios/Config/Shared.xcconfig')).toMatch(
      new RegExp(`^MARKETING_VERSION = ${version.replaceAll('.', '\\.')}$`, 'm'),
    );
  });

  it('gives the extension a bundle id inside the app bundle id', () => {
    const config = read('ios/Config/Shared.xcconfig');
    const app = config.match(/^NB_BUNDLE_ID = (\S+)$/m)?.[1];
    const extension = config.match(/^NB_EXTENSION_BUNDLE_ID = (\S+)$/m)?.[1];
    expect(app).toBeTruthy();
    expect(extension?.startsWith(`${app}.`)).toBe(true);
  });

  it('shares one App Group between the app and the extension', () => {
    const spec = read('ios/project.yml');
    expect(spec.match(/\$\(NB_APP_GROUP\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(read('ios/Config/Shared.xcconfig')).toMatch(/^NB_APP_GROUP = group\.\S+$/m);
  });
});
