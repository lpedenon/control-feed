import type { Settings } from '../core/settings';
import {
  type ContactReason,
  PROTOCOL_VERSION,
  parseSyncResponse,
  SITE_HOSTS,
  type SiteAccess,
  type SiteHost,
  type SyncRequest,
} from './protocol';

/** Everything the sync needs from its surroundings, so it can be run against fakes. */
export interface SyncDeps {
  loadSettings(): Promise<Settings>;
  loadSettingsUpdatedAt(): Promise<number>;
  /** Stores settings received from the app without stamping them as a new change. */
  applySettings(settings: Settings, updatedAt: number): Promise<void>;
  /** Sends one message to the app and resolves with its raw answer. */
  sendToApp(message: SyncRequest): Promise<unknown>;
  siteAccess(host: SiteHost): Promise<SiteAccess>;
  extensionVersion(): string;
}

export type SyncOutcome =
  | { readonly status: 'applied' }
  | { readonly status: 'unchanged' }
  | { readonly status: 'storage-failed'; readonly error: string }
  | { readonly status: 'app-unreachable'; readonly error: string }
  | { readonly status: 'app-refused'; readonly error: string }
  | { readonly status: 'invalid-response' };

export interface NativeSync {
  /** Always resolves: every failure is an outcome, never a rejection. */
  sync(reason: ContactReason, pageHost?: SiteHost | null): Promise<SyncOutcome>;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function collectSiteAccess(deps: SyncDeps): Promise<Record<SiteHost, SiteAccess>> {
  const entries = await Promise.all(
    SITE_HOSTS.map(async (host) => {
      try {
        return [host, await deps.siteAccess(host)] as const;
      } catch {
        return [host, 'unknown'] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<SiteHost, SiteAccess>;
}

/**
 * Exchanges settings with the iOS app. Whichever side changed them last wins:
 * the app's settings replace the extension's only when they are newer, and the
 * app adopts the extension's when those are. One exchange runs at a time. A
 * second request for the same reason joins the running exchange; one for
 * another reason waits its turn, so a page load during start-up is still
 * reported as a page load. Every page load that does not join a running
 * exchange starts its own, so a change made in the app reaches the next page.
 */
export function createNativeSync(deps: SyncDeps): NativeSync {
  let running: { readonly reason: ContactReason; readonly done: Promise<SyncOutcome> } | null =
    null;

  const exchange = async (
    reason: ContactReason,
    pageHost: SiteHost | null,
  ): Promise<SyncOutcome> => {
    let local: [Settings, number, Record<SiteHost, SiteAccess>];
    try {
      local = await Promise.all([
        deps.loadSettings(),
        deps.loadSettingsUpdatedAt(),
        collectSiteAccess(deps),
      ]);
    } catch (error) {
      return { status: 'storage-failed', error: describeError(error) };
    }
    const [settings, settingsUpdatedAt, siteAccess] = local;
    const request: SyncRequest = {
      type: 'sync',
      protocolVersion: PROTOCOL_VERSION,
      extensionVersion: deps.extensionVersion(),
      reason,
      settings,
      settingsUpdatedAt,
      siteAccess,
      pageHost,
    };

    let raw: unknown;
    try {
      raw = await deps.sendToApp(request);
    } catch (error) {
      return { status: 'app-unreachable', error: describeError(error) };
    }

    const response = parseSyncResponse(raw);
    if (response === null) return { status: 'invalid-response' };
    if (!response.ok) return { status: 'app-refused', error: response.error };
    if (response.settings === null || response.settingsUpdatedAt <= settingsUpdatedAt) {
      return { status: 'unchanged' };
    }
    try {
      await deps.applySettings(response.settings, response.settingsUpdatedAt);
    } catch (error) {
      return { status: 'storage-failed', error: describeError(error) };
    }
    return { status: 'applied' };
  };

  const sync = (reason: ContactReason, pageHost: SiteHost | null = null): Promise<SyncOutcome> => {
    if (running) {
      if (running.reason === reason) return running.done;
      return running.done.then(() => sync(reason, pageHost));
    }
    const done = exchange(reason, pageHost).finally(() => {
      running = null;
    });
    running = { reason, done };
    return done;
  };

  return { sync };
}
