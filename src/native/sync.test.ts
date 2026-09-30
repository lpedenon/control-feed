import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, withFeature } from '../core/settings';
import { PROTOCOL_VERSION, type SiteAccess, type SiteHost, type SyncRequest } from './protocol';
import { createNativeSync, PAGE_SYNC_INTERVAL_MS, type SyncDeps } from './sync';

const APP_SETTINGS = withFeature(DEFAULT_SETTINGS, 'ytShorts', false);

function answer(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    appVersion: '1.0',
    settings: APP_SETTINGS,
    settingsUpdatedAt: 200,
    ...overrides,
  };
}

function harness(options: { response?: unknown; sendError?: Error; updatedAt?: number } = {}) {
  let time = 1_000_000;
  let updatedAt = options.updatedAt ?? 100;
  const sent: SyncRequest[] = [];
  const applied: { settingsUpdatedAt: number; ytShorts: boolean }[] = [];
  const access: Record<SiteHost, SiteAccess | Error> = {
    'm.youtube.com': 'granted',
    'www.youtube.com': 'not-granted',
  };
  const deps: SyncDeps = {
    loadSettings: async () => DEFAULT_SETTINGS,
    loadSettingsUpdatedAt: async () => updatedAt,
    applySettings: vi.fn(async (settings, appliedAt) => {
      updatedAt = appliedAt;
      applied.push({ settingsUpdatedAt: appliedAt, ytShorts: settings.features.ytShorts });
    }),
    sendToApp: vi.fn(async (message) => {
      sent.push(message);
      if (options.sendError) throw options.sendError;
      return 'response' in options ? options.response : answer();
    }),
    siteAccess: async (host) => {
      const value = access[host];
      if (value instanceof Error) throw value;
      return value;
    },
    extensionVersion: () => '0.2.0',
    now: () => time,
  };
  return {
    deps,
    sent,
    applied,
    access,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('native sync', () => {
  it('sends the settings, version, site access and page host, and nothing else', async () => {
    const { deps, sent } = harness();
    await createNativeSync(deps).sync('page', 'm.youtube.com');
    expect(sent).toEqual([
      {
        type: 'sync',
        protocolVersion: PROTOCOL_VERSION,
        extensionVersion: '0.2.0',
        reason: 'page',
        settings: DEFAULT_SETTINGS,
        settingsUpdatedAt: 100,
        siteAccess: { 'm.youtube.com': 'granted', 'www.youtube.com': 'not-granted' },
        pageHost: 'm.youtube.com',
      },
    ]);
    expect(Object.keys(sent[0] ?? {}).sort()).toEqual([
      'extensionVersion',
      'pageHost',
      'protocolVersion',
      'reason',
      'settings',
      'settingsUpdatedAt',
      'siteAccess',
      'type',
    ]);
  });

  it('takes the app settings when they are newer', async () => {
    const { deps, applied } = harness();
    expect(await createNativeSync(deps).sync('startup')).toEqual({ status: 'applied' });
    expect(applied).toEqual([{ settingsUpdatedAt: 200, ytShorts: false }]);
  });

  it.each([
    ['older', 50],
    ['equally old', 100],
  ])('keeps the extension settings when the app copy is %s', async (_label, appUpdatedAt) => {
    const { deps, applied } = harness({ response: answer({ settingsUpdatedAt: appUpdatedAt }) });
    expect(await createNativeSync(deps).sync('startup')).toEqual({ status: 'unchanged' });
    expect(applied).toEqual([]);
  });

  it('keeps the extension settings when the app has none yet', async () => {
    const { deps, applied } = harness({ response: answer({ settings: null }) });
    expect(await createNativeSync(deps).sync('startup')).toEqual({ status: 'unchanged' });
    expect(applied).toEqual([]);
  });

  it('reports an unreachable app and changes nothing', async () => {
    const { deps, applied } = harness({ sendError: new Error('no host') });
    expect(await createNativeSync(deps).sync('startup')).toEqual({
      status: 'app-unreachable',
      error: 'no host',
    });
    expect(applied).toEqual([]);
  });

  it('reports a refusal from the app', async () => {
    const { deps, applied } = harness({ response: { ok: false, error: 'unsupported-protocol' } });
    expect(await createNativeSync(deps).sync('startup')).toEqual({
      status: 'app-refused',
      error: 'unsupported-protocol',
    });
    expect(applied).toEqual([]);
  });

  it.each([
    ['nothing', undefined],
    ['text', 'hello'],
    ['another protocol version', answer({ protocolVersion: 99 })],
  ])('refuses an answer that is %s', async (_label, response) => {
    const { deps, applied } = harness({ response });
    expect(await createNativeSync(deps).sync('startup')).toEqual({ status: 'invalid-response' });
    expect(applied).toEqual([]);
  });

  it('reports unknown site access when Safari cannot say', async () => {
    const { deps, sent, access } = harness();
    access['www.youtube.com'] = new Error('unsupported');
    await createNativeSync(deps).sync('startup');
    expect(sent[0]?.siteAccess).toEqual({
      'm.youtube.com': 'granted',
      'www.youtube.com': 'unknown',
    });
  });

  it('lets a burst of page loads share one exchange, then allows the next after a while', async () => {
    const { deps, advance } = harness();
    const sync = createNativeSync(deps);
    expect(await sync.sync('page', 'm.youtube.com')).toMatchObject({ status: 'applied' });
    advance(1000);
    expect(await sync.sync('page', 'm.youtube.com')).toEqual({ status: 'throttled' });
    expect(deps.sendToApp).toHaveBeenCalledTimes(1);
    advance(PAGE_SYNC_INTERVAL_MS);
    expect(await sync.sync('page', 'm.youtube.com')).toMatchObject({ status: 'unchanged' });
    expect(deps.sendToApp).toHaveBeenCalledTimes(2);
  });

  it('does not throttle a start-up', async () => {
    const { deps, advance } = harness();
    const sync = createNativeSync(deps);
    await sync.sync('page', 'm.youtube.com');
    await sync.sync('startup');
    advance(1);
    await sync.sync('startup');
    expect(deps.sendToApp).toHaveBeenCalledTimes(3);
  });

  it('lets a second request for the same reason join the running exchange', async () => {
    const { deps } = harness();
    const sync = createNativeSync(deps);
    const [first, second] = await Promise.all([sync.sync('startup'), sync.sync('startup')]);
    expect(second).toBe(first);
    expect(deps.sendToApp).toHaveBeenCalledTimes(1);
  });

  it('reports a page load that arrives during a start-up exchange as a page load', async () => {
    const { deps, sent } = harness();
    const sync = createNativeSync(deps);
    const [, page] = await Promise.all([sync.sync('startup'), sync.sync('page', 'm.youtube.com')]);
    expect(sent.map((message) => message.reason)).toEqual(['startup', 'page']);
    expect(sent[1]?.pageHost).toBe('m.youtube.com');
    expect(page.status).not.toBe('throttled');
  });

  it('never runs two exchanges at once', async () => {
    let active = 0;
    let overlapped = false;
    const { deps } = harness();
    const send = deps.sendToApp;
    const slow: SyncDeps = {
      ...deps,
      sendToApp: async (message) => {
        active += 1;
        overlapped ||= active > 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return send(message);
      },
    };
    const sync = createNativeSync(slow);
    await Promise.all([sync.sync('startup'), sync.sync('page'), sync.sync('startup')]);
    expect(overlapped).toBe(false);
  });

  it('allows a new exchange after a failed one', async () => {
    const { deps } = harness({ sendError: new Error('no host') });
    const sync = createNativeSync(deps);
    await sync.sync('startup');
    await sync.sync('startup');
    expect(deps.sendToApp).toHaveBeenCalledTimes(2);
  });

  it('does not count a throttled page load against the start of the interval', async () => {
    const { deps, advance } = harness();
    const sync = createNativeSync(deps);
    await sync.sync('page');
    advance(PAGE_SYNC_INTERVAL_MS - 1);
    expect(await sync.sync('page')).toEqual({ status: 'throttled' });
    advance(1);
    expect((await sync.sync('page')).status).not.toBe('throttled');
  });
});
