import { join } from 'node:path';
import {
  type BrowserContext,
  test as base,
  expect as baseExpect,
  chromium,
  type Page,
  type Worker,
} from '@playwright/test';
import type { Settings } from '../../src/core/settings';
import { copyInstagramProfile } from './instagram-profile';

export const EXTENSION_PATH = join(import.meta.dirname, '..', '..', '.output', 'chrome-mv3');

/** How long the freshly installed extension may take to open its welcome tab. */
const WELCOME_TAB_TIMEOUT_MS = 10_000;

interface ExtensionOptions {
  /** 'instagram' starts from a copy of the logged-in Instagram test profile. */
  profile: 'fresh' | 'instagram';
}

interface ExtensionFixtures {
  context: BrowserContext;
  /** The settings tab the extension opened on install; used to write settings. */
  settingsTab: Page;
  serviceWorker: Worker;
  extensionId: string;
  /** Replaces the stored settings; open pages pick the change up live. */
  setSettings: (settings: Settings) => Promise<void>;
}

/**
 * On install the extension opens its settings in a tab. Waiting for it checks
 * that behavior and keeps it from taking over a page a test is navigating.
 * The tab is then kept as the test's handle for writing settings: extension
 * pages can use chrome.storage directly, unlike the background service
 * worker, which Chrome may stop at any time.
 */
async function waitForWelcomeTab(context: BrowserContext, extensionId: string): Promise<Page> {
  const optionsUrl = `chrome-extension://${extensionId}/options.html`;
  const findTab = () => context.pages().find((page) => page.url().startsWith(optionsUrl));
  await baseExpect
    .poll(() => findTab() !== undefined, {
      message: 'the settings page should open on install',
      timeout: WELCOME_TAB_TIMEOUT_MS,
    })
    .toBe(true);
  const tab = findTab() as Page;
  await tab.waitForLoadState('domcontentloaded');
  return tab;
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
    // Hand the browser to tests only once the welcome tab exists, so it can
    // never take over a tab a test has already started using.
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await waitForWelcomeTab(context, new URL(worker.url()).host);
    await use(context);
    await context.close();
    await copy?.cleanup();
  },
  settingsTab: async ({ context, extensionId }, use) => {
    await use(await waitForWelcomeTab(context, extensionId));
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  setSettings: async ({ settingsTab }, use) => {
    await use(async (settings) => {
      await settingsTab.evaluate(
        (value) => chrome.storage.local.set({ settings: value }),
        settings,
      );
    });
  },
});

export const expect = test.expect;
