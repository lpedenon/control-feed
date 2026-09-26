/**
 * Renders assets/icon.svg to the PNG sizes browsers ask extensions for.
 *   node tools/render-icons.ts
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const SIZES = [16, 32, 48, 96, 128] as const;

async function main(): Promise<void> {
  const svg = await readFile(join(ROOT, 'assets', 'icon.svg'), 'utf8');
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const browser = await chromium.launch();
  try {
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}</style><img src="${src}" width="${size}" height="${size}">`,
      );
      const file = join(ROOT, 'public', 'icon', `${size}.png`);
      await page.screenshot({ path: file, omitBackground: true });
      await page.close();
      process.stdout.write(`rendered ${file}\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`render failed: ${String(error)}\n`);
  process.exitCode = 1;
});
