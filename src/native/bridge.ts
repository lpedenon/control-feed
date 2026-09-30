import { loadSettings, loadSettingsUpdatedAt, saveSettings } from '../core/settings-store';
import { isSiteHost, PAGE_CONTACT_MESSAGE, type SiteAccess, type SiteHost } from './protocol';
import { createNativeSync, type NativeSync, type SyncDeps } from './sync';

/** Safari ignores this and always talks to the app that contains the extension. */
const NATIVE_APP_ID = 'application.id';

/** The few pieces of the extension API the bridge uses. */
export interface BridgeApi {
  readonly runtime: {
    readonly id: string;
    getManifest(): { readonly version: string };
    sendNativeMessage(application: string, message: object): Promise<unknown>;
    readonly onStartup: { addListener(listener: () => void): void };
    readonly onInstalled: { addListener(listener: () => void): void };
    readonly onMessage: {
      addListener(
        listener: (message: unknown, sender: { id?: string | undefined; url?: string }) => void,
      ): void;
    };
  };
  readonly permissions: {
    contains(query: { origins: string[] }): Promise<boolean>;
  };
}

async function siteAccess(api: BridgeApi, host: SiteHost): Promise<SiteAccess> {
  const granted = await api.permissions.contains({ origins: [`https://${host}/*`] });
  return granted ? 'granted' : 'not-granted';
}

export function createBridgeDeps(api: BridgeApi): SyncDeps {
  return {
    loadSettings,
    loadSettingsUpdatedAt,
    applySettings: saveSettings,
    sendToApp: (message) => api.runtime.sendNativeMessage(NATIVE_APP_ID, message),
    siteAccess: (host) => siteAccess(api, host),
    extensionVersion: () => api.runtime.getManifest().version,
    now: Date.now,
  };
}

/** The supported site a message's sender is on, or null for anything else. */
function hostOf(url: string | undefined): SiteHost | null {
  try {
    const { hostname } = new URL(url ?? '');
    return isSiteHost(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

function report(outcome: Awaited<ReturnType<NativeSync['sync']>>): void {
  if (outcome.status === 'app-unreachable' || outcome.status === 'app-refused') {
    console.warn(`[No Brainrot] Could not sync with the app: ${outcome.error}`);
  } else if (outcome.status === 'invalid-response') {
    console.warn('[No Brainrot] The app sent an answer this version does not understand.');
  }
}

/**
 * Keeps the settings in step with the iOS app: on start-up, and whenever a
 * content script reports that a supported page has loaded. Content scripts
 * cannot reach the app themselves, so they ask this background page to.
 */
export function registerNativeBridge(api: BridgeApi, sync: NativeSync): void {
  const start = () => void sync.sync('startup').then(report);
  api.runtime.onStartup.addListener(start);
  api.runtime.onInstalled.addListener(start);

  api.runtime.onMessage.addListener((message, sender) => {
    if (message !== PAGE_CONTACT_MESSAGE || sender.id !== api.runtime.id) return;
    void sync.sync('page', hostOf(sender.url)).then(report);
  });
}

export function startNativeBridge(api: BridgeApi): void {
  registerNativeBridge(api, createNativeSync(createBridgeDeps(api)));
}
