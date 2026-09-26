import { join } from 'node:path';
import { type BrowserContext, test as base, chromium, type Worker } from '@playwright/test';
import type { Settings } from '../../src/core/settings';
import { copyInstagramProfile } from './instagram-profile';

export const EXTENSION_PATH = join(import.meta.dirname, '..', '..', '.output', 'chrome-mv3');

interface ExtensionOptions {
  /** 'instagram' starts from a copy of the logged-in Instagram test profile. */
  profile: 'fresh' | 'instagram';
}

interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  /** Replaces the stored settings; open pages pick the change up live. */
  setSettings: (settings: Settings) => Promise<void>;
}

/**
 * Launches Chromium with the built extension loaded (run `pnpm build` first).
 * Extensions need the full Chromium build, which Playwright runs headless.
 */
export const test = base.extend<ExtensionFixtures & ExtensionOptions>({
  profile: ['fresh', { option: true }],
  context: async ({ profile }, use) => {
    const copy = profile === 'instagram' ? await copyInstagramProfile() : null;
    const context = await chromium.launchPersistentContext(copy?.dir ?? '', {
      channel: 'chromium',
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    await use(context);
    await context.close();
    await copy?.cleanup();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  setSettings: async ({ serviceWorker }, use) => {
    await use(async (settings) => {
      await serviceWorker.evaluate(
        (value) => chrome.storage.local.set({ settings: value }),
        settings,
      );
    });
  },
});

export const expect = test.expect;
