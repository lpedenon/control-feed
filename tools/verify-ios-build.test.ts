import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyBuiltApp } from './verify-ios-build';

const onMac = process.platform === 'darwin';

function plist(entries: Record<string, unknown>): string {
  const value = (item: unknown): string => {
    if (Array.isArray(item)) return `<array>${item.map(value).join('')}</array>`;
    if (item !== null && typeof item === 'object') {
      return `<dict>${Object.entries(item)
        .map(([k, v]) => `<key>${k}</key>${value(v)}`)
        .join('')}</dict>`;
    }
    return `<string>${String(item)}</string>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0">${value(entries)}</plist>`;
}

const MANIFEST = {
  manifest_version: 2,
  permissions: ['storage', 'nativeMessaging'],
  background: { persistent: false, scripts: ['background.js'] },
  content_scripts: [{ matches: ['https://m.youtube.com/*'], js: ['content-scripts/youtube.js'] }],
  browser_action: { default_popup: 'popup.html' },
};

let root: string;
let app: string;
let appex: string;

async function build(): Promise<void> {
  await mkdir(join(appex, 'content-scripts'), { recursive: true });
  await writeFile(
    join(app, 'Info.plist'),
    plist({
      CFBundleIdentifier: 'io.example.app',
      CFBundleURLTypes: [{ CFBundleURLSchemes: ['nobrainrot'] }],
      LSApplicationQueriesSchemes: ['youtube'],
      NBAppGroupIdentifier: 'group.io.example.app',
    }),
  );
  await writeFile(
    join(appex, 'Info.plist'),
    plist({
      CFBundleIdentifier: 'io.example.app.extension',
      NSExtension: {
        NSExtensionPointIdentifier: 'com.apple.Safari.web-extension',
        NSExtensionPrincipalClass: 'NoBrainrotExtension.SafariWebExtensionHandler',
      },
      NBAppGroupIdentifier: 'group.io.example.app',
    }),
  );
  await writeFile(join(appex, 'manifest.json'), JSON.stringify(MANIFEST));
  for (const file of ['background.js', 'popup.html', 'content-scripts/youtube.js']) {
    await writeFile(join(appex, file), '');
  }
  for (const dir of [app, appex]) await writeFile(join(dir, 'PrivacyInfo.xcprivacy'), '');
  await writeFile(join(app, 'Assets.car'), '');
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'verify-ios-'));
  app = join(root, 'NoBrainrot.app');
  appex = join(app, 'PlugIns', 'NoBrainrotExtension.appex');
  await mkdir(appex, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe.skipIf(!onMac)('verifyBuiltApp', () => {
  it('accepts an app that is put together correctly', async () => {
    await build();
    expect(await verifyBuiltApp(app)).toEqual([]);
  });

  it('notices a missing extension', async () => {
    await rm(appex, { recursive: true });
    expect(await verifyBuiltApp(app)).toEqual([
      'The app does not embed NoBrainrotExtension.appex in PlugIns.',
    ]);
  });

  it.each([
    ['the manifest', 'manifest.json', 'The extension bundle has no manifest.json at its root.'],
    [
      'a script the manifest names',
      'background.js',
      'manifest.json references background.js, which is missing.',
    ],
    ['the popup', 'popup.html', 'The popup popup.html is missing.'],
    [
      'the extension privacy manifest',
      'PrivacyInfo.xcprivacy',
      'The extension has no privacy manifest.',
    ],
  ])('notices when %s is missing', async (_label, file, problem) => {
    await build();
    await rm(join(appex, file));
    expect(await verifyBuiltApp(app)).toContain(problem);
  });

  it('notices a manifest without native messaging or the phone site', async () => {
    await build();
    await writeFile(
      join(appex, 'manifest.json'),
      JSON.stringify({
        ...MANIFEST,
        permissions: ['storage'],
        content_scripts: [
          { matches: ['https://www.youtube.com/*'], js: ['content-scripts/youtube.js'] },
        ],
      }),
    );
    const problems = await verifyBuiltApp(app);
    expect(problems).toContain('manifest.json lacks the nativeMessaging permission.');
    expect(problems).toContain('No content script runs on https://m.youtube.com/*.');
  });

  it('notices a bundled Instagram script', async () => {
    await build();
    await writeFile(
      join(appex, 'manifest.json'),
      JSON.stringify({
        ...MANIFEST,
        content_scripts: [
          ...MANIFEST.content_scripts,
          { matches: ['https://www.instagram.com/*'], js: ['content-scripts/youtube.js'] },
        ],
      }),
    );
    expect(await verifyBuiltApp(app)).toContain(
      'An Instagram content script is bundled; the iOS app supports YouTube only.',
    );
  });

  it('notices differing App Groups and a missing link scheme', async () => {
    await build();
    await writeFile(
      join(app, 'Info.plist'),
      plist({
        CFBundleIdentifier: 'io.example.app',
        CFBundleURLTypes: [{ CFBundleURLSchemes: ['other'] }],
        LSApplicationQueriesSchemes: [],
        NBAppGroupIdentifier: 'group.somewhere.else',
      }),
    );
    const problems = await verifyBuiltApp(app);
    expect(problems).toContain('The app and the extension name different App Groups.');
    expect(problems).toContain('The app does not register the nobrainrot:// link.');
    expect(problems).toContain('The app cannot ask whether the YouTube app is installed.');
  });

  it('notices an extension that is not a Safari web extension', async () => {
    await build();
    await writeFile(
      join(appex, 'Info.plist'),
      plist({
        CFBundleIdentifier: 'io.example.other',
        NSExtension: { NSExtensionPointIdentifier: 'com.apple.widget-extension' },
        NBAppGroupIdentifier: 'group.io.example.app',
      }),
    );
    const problems = await verifyBuiltApp(app);
    expect(problems).toContain('The extension does not declare com.apple.Safari.web-extension.');
    expect(problems).toContain(
      'The extension has no SafariWebExtensionHandler as its principal class.',
    );
    expect(problems).toContain('The extension bundle id is not inside the app bundle id.');
  });

  it('has plutil to read plists with', () => {
    expect(execFileSync('plutil', ['-help'], { stdio: 'pipe' }).length).toBeGreaterThanOrEqual(0);
    expect(cp).toBeDefined();
  });
});
