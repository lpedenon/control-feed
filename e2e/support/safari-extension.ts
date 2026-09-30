import { join } from 'node:path';
import {
  type BrowserContext,
  test as base,
  expect as baseExpect,
  chromium,
  devices,
  type Worker,
} from '@playwright/test';

/** The Safari flavour of the extension, built as MV3 so Chromium can load it (pnpm test:e2e builds it). */
export const SAFARI_FLAVOUR_PATH = join(import.meta.dirname, '..', '..', '.output', 'safari-mv3');

/** What the fake app answers with: a reply, or an error like a missing native host. */
export type FakeAppAnswer = { readonly reply: unknown } | { readonly error: string };

export interface FakeApp {
  /** Sets how the "app" answers the extension's next messages. */
  answerWith(answer: FakeAppAnswer): Promise<void>;
  /** Every message the extension has sent to the "app" so far. */
  messages(): Promise<readonly Record<string, unknown>[]>;
}

interface Fixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  app: FakeApp;
  /** Everything in the extension's storage, read from its background page. */
  storage: () => Promise<Record<string, unknown>>;
}

/** The little of the extension API the stand-in touches inside the background page. */
interface BackgroundChrome {
  runtime: { sendNativeMessage: (application: string, message: object) => Promise<unknown> };
  storage: { local: { get(keys: null): Promise<Record<string, unknown>> } };
}
type BackgroundGlobal = { chrome: BackgroundChrome };

/**
 * Loads the Safari flavour into Chromium with an iPhone's user agent and screen.
 * Chromium has no Safari app to talk to, so the tests stand in for it by
 * replacing the background page's native-messaging call. Everything else is the
 * shipped code: the content script, the background page, storage and messaging
 * between them. It is Chromium, not Safari, and says nothing about how Safari
 * grants site access or wakes the background page.
 */
export const test = base.extend<Fixtures>({
  context: async ({ browser: _browser }, use) => {
    const { userAgent, viewport, deviceScaleFactor, isMobile, hasTouch } = devices['iPhone 15'];
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      locale: 'en-US',
      userAgent,
      viewport,
      deviceScaleFactor,
      isMobile,
      hasTouch,
      args: [
        `--disable-extensions-except=${SAFARI_FLAVOUR_PATH}`,
        `--load-extension=${SAFARI_FLAVOUR_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  storage: async ({ serviceWorker }, use) => {
    await use(() =>
      serviceWorker.evaluate(() =>
        (globalThis as unknown as BackgroundGlobal).chrome.storage.local.get(null),
      ),
    );
  },
  app: async ({ serviceWorker }, use) => {
    // Waits for the start-up exchange (which fails: there is no native host) to finish first,
    // so it cannot share an exchange with the page load a test is about to cause.
    await baseExpect.poll(() => serviceWorker.evaluate(() => 'chrome' in globalThis)).toBe(true);
    await use({
      answerWith: (answer) =>
        serviceWorker.evaluate((next) => {
          const state = globalThis as unknown as {
            __app?: { messages: Record<string, unknown>[] };
          };
          const app = state.__app ?? { messages: [] };
          state.__app = app;
          (globalThis as unknown as BackgroundGlobal).chrome.runtime.sendNativeMessage = (
            _application,
            message,
          ) => {
            app.messages.push(message as Record<string, unknown>);
            return 'error' in next
              ? Promise.reject(new Error(next.error))
              : Promise.resolve(next.reply);
          };
        }, answer),
      messages: () =>
        serviceWorker.evaluate(
          () =>
            (globalThis as unknown as { __app?: { messages: Record<string, unknown>[] } }).__app
              ?.messages ?? [],
        ),
    });
  },
});

export const expect = test.expect;
