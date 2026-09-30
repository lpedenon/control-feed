/**
 * Renders assets/icon.svg to the PNG sizes browsers ask extensions for, and to
 * the square 1024px icon of the iOS app (iOS rounds the corners itself, so that
 * one is drawn full-bleed and opaque).
 *   node tools/render-icons.ts
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const SIZES = [16, 32, 48, 96, 128] as const;
const IOS_ICON = join(
  ROOT,
  'ios',
  'App',
  'Resources',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'icon-1024.png',
);
const IOS_ICON_SIZE = 1024;

function dataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function main(): Promise<void> {
  const svg = await readFile(join(ROOT, 'assets', 'icon.svg'), 'utf8');
  const src = dataUrl(svg);
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

    const square = svg.replace('rx="28"', 'rx="0"');
    if (square === svg)
      throw new Error('assets/icon.svg no longer has the rounded tile to square off.');
    const page = await browser.newPage({
      viewport: { width: IOS_ICON_SIZE, height: IOS_ICON_SIZE },
    });
    await page.setContent(
      `<style>html,body{margin:0;background:#3d1bb8}</style><img src="${dataUrl(square)}" width="${IOS_ICON_SIZE}" height="${IOS_ICON_SIZE}">`,
    );
    await page.screenshot({ path: IOS_ICON });
    await page.close();
    process.stdout.write(`rendered ${IOS_ICON}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`render failed: ${String(error)}\n`);
  process.exitCode = 1;
});
