/**
 * Checks a built No Brainrot.app the way the phone will meet it: the Safari
 * extension is embedded with its web files where Safari looks for them, the
 * native handler and App Group are declared, and the app can be reached by the
 * link the extension's popup uses. macOS only (it reads plists with plutil).
 *   node tools/verify-ios-build.ts path/to/NoBrainrot.app
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

type Json = Record<string, unknown>;

async function readPlist(path: string): Promise<Json> {
  const { stdout } = await run('plutil', ['-convert', 'json', '-o', '-', path]);
  return JSON.parse(stdout) as Json;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function checkExtensionInfo(info: Json, appId: string, problems: string[]): void {
  const extension = (info.NSExtension ?? {}) as Json;
  if (extension.NSExtensionPointIdentifier !== 'com.apple.Safari.web-extension') {
    problems.push('The extension does not declare com.apple.Safari.web-extension.');
  }
  if (!String(extension.NSExtensionPrincipalClass ?? '').endsWith('.SafariWebExtensionHandler')) {
    problems.push('The extension has no SafariWebExtensionHandler as its principal class.');
  }
  if (!String(info.CFBundleIdentifier ?? '').startsWith(`${appId}.`)) {
    problems.push('The extension bundle id is not inside the app bundle id.');
  }
}

async function checkWebFiles(appex: string, problems: string[]): Promise<void> {
  const manifestPath = join(appex, 'manifest.json');
  if (!existsSync(manifestPath)) {
    problems.push('The extension bundle has no manifest.json at its root.');
    return;
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Json;
  const permissions = asStrings(manifest.permissions);
  for (const needed of ['storage', 'nativeMessaging']) {
    if (!permissions.includes(needed))
      problems.push(`manifest.json lacks the ${needed} permission.`);
  }

  const scripts = (manifest.content_scripts ?? []) as { matches?: string[]; js?: string[] }[];
  if (!scripts.some((script) => asStrings(script.matches).includes('https://m.youtube.com/*'))) {
    problems.push('No content script runs on https://m.youtube.com/*.');
  }
  if (
    scripts.some((script) => asStrings(script.matches).some((match) => match.includes('instagram')))
  ) {
    problems.push('An Instagram content script is bundled; the iOS app supports YouTube only.');
  }
  const background = (manifest.background ?? {}) as { scripts?: string[]; service_worker?: string };
  const referenced = [
    ...scripts.flatMap((script) => asStrings(script.js)),
    ...asStrings(background.scripts),
    ...(background.service_worker ? [background.service_worker] : []),
  ];
  if (referenced.length === 0) problems.push('manifest.json references no scripts.');
  for (const file of referenced) {
    if (!existsSync(join(appex, file)))
      problems.push(`manifest.json references ${file}, which is missing.`);
  }
  const action = (manifest.action ?? manifest.browser_action ?? {}) as { default_popup?: string };
  if (action.default_popup && !existsSync(join(appex, action.default_popup))) {
    problems.push(`The popup ${action.default_popup} is missing.`);
  }
}

/** Returns what is wrong with a built app, or an empty list. */
export async function verifyBuiltApp(appPath: string): Promise<string[]> {
  const problems: string[] = [];
  const appex = join(appPath, 'PlugIns', 'NoBrainrotExtension.appex');
  if (!existsSync(appex)) return ['The app does not embed NoBrainrotExtension.appex in PlugIns.'];

  const appInfo = await readPlist(join(appPath, 'Info.plist'));
  const extensionInfo = await readPlist(join(appex, 'Info.plist'));
  checkExtensionInfo(extensionInfo, String(appInfo.CFBundleIdentifier ?? ''), problems);

  const schemes = ((appInfo.CFBundleURLTypes ?? []) as { CFBundleURLSchemes?: string[] }[]).flatMap(
    (type) => asStrings(type.CFBundleURLSchemes),
  );
  if (!schemes.includes('nobrainrot'))
    problems.push('The app does not register the nobrainrot:// link.');
  if (!asStrings(appInfo.LSApplicationQueriesSchemes).includes('youtube')) {
    problems.push('The app cannot ask whether the YouTube app is installed.');
  }

  const group = String(appInfo.NBAppGroupIdentifier ?? '');
  if (!group.startsWith('group.')) problems.push('The app names no App Group.');
  if (extensionInfo.NBAppGroupIdentifier !== appInfo.NBAppGroupIdentifier) {
    problems.push('The app and the extension name different App Groups.');
  }

  for (const [label, dir] of [
    ['app', appPath],
    ['extension', appex],
  ] as const) {
    if (!existsSync(join(dir, 'PrivacyInfo.xcprivacy')))
      problems.push(`The ${label} has no privacy manifest.`);
  }
  if (!existsSync(join(appPath, 'Assets.car')))
    problems.push('The app has no compiled asset catalog (icon, accent color).');

  await checkWebFiles(appex, problems);
  return problems;
}

async function main(): Promise<void> {
  const appPath = process.argv[2];
  if (!appPath) throw new Error('Usage: node tools/verify-ios-build.ts path/to/NoBrainrot.app');
  const problems = await verifyBuiltApp(appPath);
  for (const problem of problems) process.stderr.write(`problem: ${problem}\n`);
  if (problems.length > 0) process.exitCode = 1;
  else process.stdout.write(`ok: ${appPath}\n`);
}

if (import.meta.filename === process.argv[1]) {
  main().catch((error: unknown) => {
    process.stderr.write(`verify failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
