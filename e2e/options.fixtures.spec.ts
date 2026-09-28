import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { HIDDEN_ATTRIBUTE } from '../src/core/stylesheet';
import { expect, test } from './support/extension';
import { serveFixtures } from './support/fixture-server';

const SCREENS = join(import.meta.dirname, '..', '.screens', 'options');

test.beforeEach(async ({ context, setSettings }) => {
  await serveFixtures(context);
  await setSettings(DEFAULT_SETTINGS);
});

async function openOptions(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('switch', { name: /Hide Shorts/ })).toBeVisible();
  return page;
}

async function openYoutube(context: BrowserContext, path: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`https://www.youtube.com${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#control-feed-style[data-settings="stored"]')).toBeAttached();
  return page;
}

test('shows every setting with its current value', async ({ context, extensionId }) => {
  const options = await openOptions(context, extensionId);
  await expect(options.getByRole('switch', { name: /Hide Shorts/ })).toBeChecked();
  await expect(options.getByRole('switch', { name: /Hide comments/ })).not.toBeChecked();
  await expect(
    options.getByRole('switch', { name: /Show only accounts you follow/ }),
  ).toBeChecked();
  await expect(options.getByRole('switch', { name: 'YouTube', exact: true })).toBeChecked();
  await expect(options.getByLabel('Blocked words in titles')).toHaveValue('');

  await options.screenshot({
    path: join(SCREENS, 'light.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await options.emulateMedia({ colorScheme: 'dark' });
  await options.screenshot({
    path: join(SCREENS, 'dark.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await options.setViewportSize({ width: 375, height: 812 });
  await options.emulateMedia({ colorScheme: 'light' });
  await options.screenshot({
    path: join(SCREENS, 'narrow.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('a switch flipped here changes an open YouTube tab at once', async ({
  context,
  extensionId,
}) => {
  const watch = await openYoutube(context, '/watch?v=fNk_zzaMoSs');
  await expect(watch.locator('ytd-comments#comments')).toBeVisible();

  const options = await openOptions(context, extensionId);
  await options.getByRole('switch', { name: /Hide comments/ }).check();
  await expect(options.getByRole('status')).toContainText('Saved');

  await expect(watch.locator('ytd-comments#comments')).toBeHidden();
});

test('typing a blocked word filters an open search tab', async ({ context, extensionId }) => {
  const search = await openYoutube(context, '/results?search_query=linear+algebra');
  const options = await openOptions(context, extensionId);

  await options.getByLabel('Blocked words in titles').fill('essence');
  await expect(options.getByRole('status')).toContainText('Saved');

  await expect(
    search.locator(`ytd-video-renderer[${HIDDEN_ATTRIBUTE}="blocked-keyword"]`).first(),
  ).toBeHidden();
});

test('adding a topic and choosing only it filters an open search tab', async ({
  context,
  extensionId,
}) => {
  const search = await openYoutube(context, '/results?search_query=linear+algebra');
  const options = await openOptions(context, extensionId);

  await options.getByRole('radio', { name: /Only show videos about these topics/ }).check();
  await expect(options.getByText('Add a topic and give it')).toBeVisible();
  await options.getByLabel('Add a topic').fill('AI');
  await options.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(options.getByLabel('AI', { exact: true })).toHaveValue(/machine learning/);
  await expect(options.getByText('Add a topic and give it')).toBeHidden();
  await options.getByLabel('Add a topic').fill('Linear algebra');
  await options.getByLabel('Add a topic').press('Enter');
  await expect(options.getByLabel('Linear algebra', { exact: true })).toHaveValue('Linear algebra');
  await expect(options.getByRole('status')).toContainText('Saved');
  await options.screenshot({
    path: join(SCREENS, 'topics.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await options.emulateMedia({ colorScheme: 'dark' });
  await options.screenshot({
    path: join(SCREENS, 'topics-dark.png'),
    fullPage: true,
    animations: 'disabled',
  });

  // Nearly every fixture result says "linear algebra"; without that topic, none shows.
  const visibleResults = () =>
    search
      .locator('ytd-video-renderer')
      .evaluateAll((elements) => elements.filter((e) => e.checkVisibility()).length);
  await expect.poll(visibleResults).toBeGreaterThan(5);
  await options.getByRole('button', { name: 'Remove the topic Linear algebra' }).click();
  await expect.poll(visibleResults).toBe(0);
});

test('the allowlist warning appears until a channel is added', async ({ context, extensionId }) => {
  const options = await openOptions(context, extensionId);
  const warning = options.getByText('Add at least one allowed channel');
  await expect(warning).toBeHidden();
  await options.getByRole('switch', { name: /Only show videos from allowed channels/ }).check();
  await expect(warning).toBeVisible();
  await options.screenshot({
    path: join(SCREENS, 'allowlist-warning.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await options.getByLabel('Allowed channels', { exact: true }).fill('3Blue1Brown');
  await expect(warning).toBeHidden();
});

test('switching a site off greys its section and stops filtering', async ({
  context,
  extensionId,
}) => {
  const search = await openYoutube(context, '/results?search_query=linear+algebra');
  await expect(search.locator('grid-shelf-view-model').first()).toBeHidden();

  const options = await openOptions(context, extensionId);
  await options.getByRole('switch', { name: 'YouTube', exact: true }).uncheck();
  await expect(options.locator('section[data-enabled="false"]')).toHaveCount(1);

  await expect(search.locator('grid-shelf-view-model').first()).toBeVisible();
});
