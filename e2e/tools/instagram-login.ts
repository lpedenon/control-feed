/**
 * Opens a browser window so you can log in to Instagram once. The session is
 * kept in e2e/.auth/instagram (git-ignored) and reused by the live Instagram
 * tests and the fixture capture script. Nothing is sent anywhere else.
 *
 *   node e2e/tools/instagram-login.ts
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { INSTAGRAM_LOGGED_IN_MARKER, INSTAGRAM_PROFILE_DIR } from '../support/instagram-profile.ts';

const LOGIN_TIMEOUT_MS = 10 * 60_000;

async function main(): Promise<void> {
  const context = await chromium.launchPersistentContext(INSTAGRAM_PROFILE_DIR, {
    channel: 'chromium',
    headless: false,
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('https://www.instagram.com/accounts/login/');
    process.stdout.write('Log in to Instagram in the window that just opened…\n');
    // Logged in once the session cookie exists.
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const cookies = await context.cookies('https://www.instagram.com');
      if (cookies.some((cookie) => cookie.name === 'sessionid')) {
        await page.waitForTimeout(3000);
        await writeFile(INSTAGRAM_LOGGED_IN_MARKER, new Date().toISOString());
        process.stdout.write('Logged in. Session saved; this window closes by itself.\n');
        return;
      }
      await page.waitForTimeout(1000);
    }
    throw new Error('Timed out waiting for Instagram login.');
  } finally {
    await context.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`login failed: ${String(error)}\n`);
  process.exitCode = 1;
});
