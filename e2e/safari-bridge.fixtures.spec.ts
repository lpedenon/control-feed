import { DEFAULT_SETTINGS, withFeature } from '../src/core/settings';
import { PROTOCOL_VERSION } from '../src/native/protocol';
import { serveFixtures } from './support/fixture-server';
import { expect, test } from './support/safari-extension';

/**
 * The Safari flavour of the extension in Chromium, with a stand-in for the iOS
 * app. It checks the parts of the bridge that unit tests can only fake: the
 * content script telling the background page, the background page talking to
 * "the app", and settings coming back into a running page.
 */
const HOME = 'https://m.youtube.com/';

test.beforeEach(async ({ context }) => {
  await serveFixtures(context);
});

const appAnswer = (settings: unknown, settingsUpdatedAt: number) => ({
  ok: true,
  protocolVersion: PROTOCOL_VERSION,
  appVersion: '1.0',
  settings,
  settingsUpdatedAt,
});

test('tells the app when a YouTube page loads, and shows what the page is on, never its address', async ({
  context,
  app,
}) => {
  await app.answerWith({ reply: appAnswer(null, 0) });
  const page = await context.newPage();
  await page.goto(`${HOME}watch?v=fNk_zzaMoSs&list=PRIVATE`, { waitUntil: 'domcontentloaded' });

  // The start-up exchange may also reach the stand-in; the page load is the one under test.
  const pageMessage = () => app.messages().then((all) => all.find((m) => m.reason === 'page'));
  await expect.poll(pageMessage).toBeDefined();
  const message = await pageMessage();
  expect(message).toMatchObject({
    type: 'sync',
    protocolVersion: PROTOCOL_VERSION,
    reason: 'page',
    pageHost: 'm.youtube.com',
    extensionVersion: expect.any(String),
  });
  expect(Object.keys(message ?? {}).sort()).toEqual([
    'extensionVersion',
    'pageHost',
    'protocolVersion',
    'reason',
    'settings',
    'settingsUpdatedAt',
    'siteAccess',
    'type',
  ]);
  const text = JSON.stringify(message);
  expect(text).not.toContain('PRIVATE');
  expect(text).not.toContain('fNk_zzaMoSs');
  expect(text).not.toContain('watch');
  expect(Object.keys((message?.siteAccess ?? {}) as object).sort()).toEqual([
    'm.youtube.com',
    'www.youtube.com',
  ]);
});

test('applies newer settings from the app to the page that reported in', async ({
  context,
  app,
  storage,
}) => {
  const showFeed = withFeature(DEFAULT_SETTINGS, 'ytHomeFeed', false);
  await app.answerWith({ reply: appAnswer(showFeed, 500) });
  const page = await context.newPage();
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });

  // With the defaults the phone home feed is hidden; the app turned that off.
  await expect(page.locator('ytm-rich-grid-renderer').first()).toBeVisible();
  expect(await storage()).toMatchObject({ settingsUpdatedAt: 500 });
});

test('keeps filtering when the app cannot be reached', async ({ context, app }) => {
  await app.answerWith({ error: 'Specified native messaging host not found.' });
  const page = await context.newPage();
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });

  await expect.poll(async () => (await app.messages()).length).toBeGreaterThan(0);
  await expect(page.locator('#no-brainrot-style[data-settings="stored"]')).toBeAttached();
  await expect(page.locator('ytm-rich-grid-renderer').first()).toBeHidden();
});

test('keeps its own settings when the app sends something it does not understand', async ({
  context,
  app,
}) => {
  await app.answerWith({ reply: 'not a message' });
  const page = await context.newPage();
  await page.goto(HOME, { waitUntil: 'domcontentloaded' });

  await expect.poll(async () => (await app.messages()).length).toBeGreaterThan(0);
  await expect(page.locator('ytm-rich-grid-renderer').first()).toBeHidden();
});
