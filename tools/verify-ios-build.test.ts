import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyBuiltApp } from './verify-ios-build';

const onMac = process.platform === 'darwin';
const VERSION = '1.2.3';

function privacyManifest(userDefaultsReasons: string[]): string {
  return plist({
    NSPrivacyAccessedAPITypes: [
      {
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
        NSPrivacyAccessedAPITypeReasons: userDefaultsReasons,
      },
    ],
  });
}

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
let generated: string;

/** What XcodeGen writes: the App Group as a build setting Xcode expands later. */
async function writeGenerated(appGroups: string[], extensionGroups: string[]): Promise<void> {
  const entitlements = (groups: string[]) =>
    plist({ 'com.apple.security.application-groups': groups });
  await writeFile(
    join(generated, 'App-Info.plist'),
    plist({ NBAppGroupIdentifier: '$(NB_APP_GROUP)' }),
  );
  await writeFile(
    join(generated, 'Extension-Info.plist'),
    plist({ NBAppGroupIdentifier: '$(NB_APP_GROUP)' }),
  );
  await writeFile(join(generated, 'App.entitlements'), entitlements(appGroups));
  await writeFile(join(generated, 'Extension.entitlements'), entitlements(extensionGroups));
}

async function build(): Promise<void> {
  await mkdir(join(appex, 'content-scripts'), { recursive: true });
  await writeFile(
    join(app, 'Info.plist'),
    plist({
      CFBundleIdentifier: 'io.example.app',
      CFBundleShortVersionString: VERSION,
      CFBundleURLTypes: [{ CFBundleURLSchemes: ['nobrainrot'] }],
      LSApplicationQueriesSchemes: ['youtube'],
      NBAppGroupIdentifier: 'group.io.example.app',
    }),
  );
  await writeFile(
    join(appex, 'Info.plist'),
    plist({
      CFBundleIdentifier: 'io.example.app.extension',
      CFBundleShortVersionString: VERSION,
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
  await writeFile(join(app, 'PrivacyInfo.xcprivacy'), privacyManifest(['1C8F.1', 'CA92.1']));
  await writeFile(join(appex, 'PrivacyInfo.xcprivacy'), privacyManifest(['1C8F.1']));
  await writeFile(join(app, 'Assets.car'), '');
  await writeGenerated(['$(NB_APP_GROUP)'], ['$(NB_APP_GROUP)']);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'verify-ios-'));
  app = join(root, 'NoBrainrot.app');
  appex = join(app, 'PlugIns', 'NoBrainrotExtension.appex');
  generated = join(root, 'Generated');
  await mkdir(appex, { recursive: true });
  await mkdir(generated);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe.skipIf(!onMac)('verifyBuiltApp', () => {
  it('accepts an app that is put together correctly', async () => {
    await build();
    expect(await verifyBuiltApp(app, VERSION, generated)).toEqual([]);
  });

  it('notices a missing extension', async () => {
    await rm(appex, { recursive: true });
    expect(await verifyBuiltApp(app, VERSION, generated)).toEqual([
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
    expect(await verifyBuiltApp(app, VERSION, generated)).toContain(problem);
  });

  it('notices a version that differs from package.json', async () => {
    await build();
    expect(await verifyBuiltApp(app, '9.9.9', generated)).toEqual([
      'The app is version 1.2.3, not 9.9.9 as in package.json.',
      'The extension is version 1.2.3, not 9.9.9 as in package.json.',
    ]);
  });

  it("notices a privacy manifest that gives no reason for the app's own UserDefaults", async () => {
    await build();
    await writeFile(join(app, 'PrivacyInfo.xcprivacy'), privacyManifest(['1C8F.1']));
    expect(await verifyBuiltApp(app, VERSION, generated)).toEqual([
      'The app privacy manifest gives no CA92.1 reason for UserDefaults.',
    ]);
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
    const problems = await verifyBuiltApp(app, VERSION, generated);
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
    expect(await verifyBuiltApp(app, VERSION, generated)).toContain(
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
    const problems = await verifyBuiltApp(app, VERSION, generated);
    expect(problems).toContain('The app and the extension name different App Groups.');
    expect(problems).toContain('The app does not register the nobrainrot:// link.');
    expect(problems).toContain('The app cannot ask whether the YouTube app is installed.');
  });

  it('notices an App Group that is not named as one', async () => {
    await build();
    for (const [dir, id] of [
      [app, 'io.example.app'],
      [appex, 'io.example.app.extension'],
    ] as const) {
      await writeFile(
        join(dir, 'Info.plist'),
        plist({
          CFBundleIdentifier: id,
          CFBundleShortVersionString: VERSION,
          CFBundleURLTypes: [{ CFBundleURLSchemes: ['nobrainrot'] }],
          LSApplicationQueriesSchemes: ['youtube'],
          NSExtension: {
            NSExtensionPointIdentifier: 'com.apple.Safari.web-extension',
            NSExtensionPrincipalClass: 'NoBrainrotExtension.SafariWebExtensionHandler',
          },
          NBAppGroupIdentifier: 'io.example.app',
        }),
      );
    }
    expect(await verifyBuiltApp(app, VERSION, generated)).toEqual(['The app names no App Group.']);
  });

  it('notices a target whose entitlements do not grant its App Group', async () => {
    await build();
    await writeGenerated([], ['$(NB_APP_GROUP)']);
    expect(await verifyBuiltApp(app, VERSION, generated)).toEqual([
      'The app entitlements do not grant the App Group its Info.plist names.',
    ]);
  });

  it('notices entitlements XcodeGen did not write', async () => {
    await build();
    await rm(join(generated, 'Extension.entitlements'));
    expect(await verifyBuiltApp(app, VERSION, generated)).toEqual([
      'The extension has no Extension.entitlements from XcodeGen.',
    ]);
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
    const problems = await verifyBuiltApp(app, VERSION, generated);
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
