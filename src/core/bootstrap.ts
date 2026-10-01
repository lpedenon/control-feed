import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { loadSettings, watchSettings } from './settings-store';
import { type SiteDefinition, startSite } from './site-runner';

/**
 * Runs a site definition for the lifetime of a content script.
 *
 * Changes are watched before the stored settings are read, so a change made
 * while the page is loading (the iOS app's settings arriving through the
 * background page, or another tab) cannot fall between the read and the watch.
 * A change seen by the watcher is newer than the read, so it always wins.
 */
export async function runSite<Info>(
  ctx: ContentScriptContext,
  definition: SiteDefinition<Info>,
): Promise<void> {
  const runner = startSite(window, definition);
  ctx.onInvalidated(() => runner.stop());

  let changedWhileLoading = false;
  ctx.onInvalidated(
    watchSettings((settings: Settings) => {
      changedWhileLoading = true;
      runner.apply(settings);
    }),
  );

  let initial: Settings;
  try {
    initial = await loadSettings();
  } catch (error) {
    // Keep protecting the page with defaults rather than showing everything.
    console.error('[No Brainrot] Could not read settings; using defaults.', error);
    initial = DEFAULT_SETTINGS;
  }
  if (!changedWhileLoading) runner.apply(initial);
}
