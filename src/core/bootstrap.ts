import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { DEFAULT_SETTINGS } from './settings';
import { loadSettings, watchSettings } from './settings-store';
import { type SiteDefinition, startSite } from './site-runner';

/** Runs a site definition for the lifetime of a content script. */
export async function runSite<Info>(
  ctx: ContentScriptContext,
  definition: SiteDefinition<Info>,
): Promise<void> {
  const runner = startSite(window, definition);
  ctx.onInvalidated(() => runner.stop());

  try {
    runner.apply(await loadSettings());
  } catch (error) {
    // Keep protecting the page with defaults rather than showing everything.
    console.error('[No Brainrot] Could not read settings; using defaults.', error);
    runner.apply(DEFAULT_SETTINGS);
  }

  ctx.onInvalidated(watchSettings((settings) => runner.apply(settings)));
}
