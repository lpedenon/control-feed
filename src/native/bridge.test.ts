import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS, withFeature } from '../core/settings';
import { loadSettings, loadSettingsUpdatedAt, saveSettings } from '../core/settings-store';
import { type BridgeApi, startNativeBridge } from './bridge';
import { PAGE_CONTACT_MESSAGE, PROTOCOL_VERSION, type SyncRequest } from './protocol';

const OWN_ID = 'own-extension-id';

type MessageListener = Parameters<BridgeApi['runtime']['onMessage']['addListener']>[0];

function fakeApi(options: { answer?: unknown; failWith?: Error; granted?: Set<string> } = {}) {
  const listeners: {
    startup: (() => void)[];
    installed: (() => void)[];
    message: MessageListener[];
  } = { startup: [], installed: [], message: [] };
  const sent: { application: string; message: SyncRequest }[] = [];
  let answer = options.answer;
  const api: BridgeApi = {
    runtime: {
      id: OWN_ID,
      getManifest: () => ({ version: '9.9.9' }),
      sendNativeMessage: vi.fn(async (application, message) => {
        sent.push({ application, message: message as SyncRequest });
        if (options.failWith) throw options.failWith;
        return answer;
      }),
      onStartup: { addListener: (l) => listeners.startup.push(l) },
      onInstalled: { addListener: (l) => listeners.installed.push(l) },
      onMessage: { addListener: (l) => listeners.message.push(l) },
    },
    permissions: {
      contains: vi.fn(async ({ origins }: { origins: string[] }) =>
        origins.every((origin: string) => options.granted?.has(origin) ?? false),
      ),
    },
  };
  const deliver = (message: unknown, sender: { id?: string; url?: string }) => {
    for (const listener of listeners.message) listener(message, sender);
  };
  /** Changes what the app answers from now on, like a change made in the app. */
  const answerWith = (next: unknown) => {
    answer = next;
  };
  return { api, listeners, sent, deliver, answerWith };
}

function appAnswer(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    protocolVersion: PROTOCOL_VERSION,
    appVersion: '1.0',
    settings: withFeature(DEFAULT_SETTINGS, 'ytComments', true),
    settingsUpdatedAt: 500,
    ...overrides,
  };
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('native bridge', () => {
  it('syncs when the extension starts and when it is installed or updated', async () => {
    const { api, listeners, sent } = fakeApi({ answer: appAnswer() });
    startNativeBridge(api);
    listeners.startup[0]?.();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.message).toMatchObject({ reason: 'startup', pageHost: null });
    listeners.installed[0]?.();
    await vi.waitFor(() => expect(sent).toHaveLength(2));
  });

  it('stores newer settings from the app without stamping them as a local change', async () => {
    const { api, listeners } = fakeApi({ answer: appAnswer() });
    startNativeBridge(api);
    listeners.startup[0]?.();
    await vi.waitFor(async () => expect(await loadSettingsUpdatedAt()).toBe(500));
    expect((await loadSettings()).features.ytComments).toBe(true);
  });

  it('sends the extension settings so the app can adopt a newer local change', async () => {
    await saveSettings(withFeature(DEFAULT_SETTINGS, 'ytShorts', false), 900);
    const { api, sent, deliver } = fakeApi({ answer: appAnswer({ settingsUpdatedAt: 500 }) });
    startNativeBridge(api);
    deliver(PAGE_CONTACT_MESSAGE, { id: OWN_ID, url: 'https://m.youtube.com/watch?v=abc' });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.message.settingsUpdatedAt).toBe(900);
    expect(sent[0]?.message.settings.features.ytShorts).toBe(false);
    expect((await loadSettings()).features.ytShorts).toBe(false);
  });

  it('reports the host of the page and the site access Safari granted, not the address', async () => {
    const { api, sent, deliver } = fakeApi({
      answer: appAnswer(),
      granted: new Set(['https://m.youtube.com/*']),
    });
    startNativeBridge(api);
    deliver(PAGE_CONTACT_MESSAGE, {
      id: OWN_ID,
      url: 'https://m.youtube.com/watch?v=secret&list=private',
    });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const { message, application } = sent[0] ?? {};
    expect(application).toBe('application.id');
    expect(message).toMatchObject({
      reason: 'page',
      pageHost: 'm.youtube.com',
      extensionVersion: '9.9.9',
      siteAccess: { 'm.youtube.com': 'granted', 'www.youtube.com': 'not-granted' },
    });
    expect(JSON.stringify(message)).not.toContain('secret');
  });

  it('does not report a page that is not a supported site', async () => {
    const { api, sent, deliver } = fakeApi({ answer: appAnswer() });
    startNativeBridge(api);
    deliver(PAGE_CONTACT_MESSAGE, { id: OWN_ID, url: 'https://example.com/' });
    deliver(PAGE_CONTACT_MESSAGE, { id: OWN_ID, url: 'not a url' });
    deliver(PAGE_CONTACT_MESSAGE, { id: OWN_ID });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.message.pageHost).toBeNull();
  });

  it('ignores messages from other extensions and other kinds of message', async () => {
    const { api, sent, deliver } = fakeApi({ answer: appAnswer() });
    startNativeBridge(api);
    deliver(PAGE_CONTACT_MESSAGE, { id: 'someone-else', url: 'https://m.youtube.com/' });
    deliver(PAGE_CONTACT_MESSAGE, { url: 'https://m.youtube.com/' });
    deliver('hello', { id: OWN_ID, url: 'https://m.youtube.com/' });
    deliver({ type: PAGE_CONTACT_MESSAGE }, { id: OWN_ID, url: 'https://m.youtube.com/' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sent).toHaveLength(0);
  });

  it('carries on when the app cannot be reached', async () => {
    const { api, listeners, sent } = fakeApi({ failWith: new Error('no host') });
    startNativeBridge(api);
    listeners.startup[0]?.();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await loadSettingsUpdatedAt()).toBe(0);
  });

  it('warns about an answer it does not understand and keeps its settings', async () => {
    const { api, listeners, sent } = fakeApi({ answer: 'garbage' });
    startNativeBridge(api);
    listeners.startup[0]?.();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(await loadSettingsUpdatedAt()).toBe(0);
  });

  it('warns when the app refuses the request', async () => {
    const { api, listeners, sent } = fakeApi({ answer: { ok: false, error: 'invalid-request' } });
    startNativeBridge(api);
    listeners.startup[0]?.();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    await vi.waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('invalid-request')),
    );
  });

  it('brings a change made in the app to a page loaded moments after the last one', async () => {
    const { api, sent, deliver, answerWith } = fakeApi({ answer: appAnswer() });
    startNativeBridge(api);
    const page = { id: OWN_ID, url: 'https://m.youtube.com/' };
    deliver(PAGE_CONTACT_MESSAGE, page);
    await vi.waitFor(async () => expect(await loadSettingsUpdatedAt()).toBe(500));

    answerWith(
      appAnswer({
        settings: withFeature(DEFAULT_SETTINGS, 'ytShorts', false),
        settingsUpdatedAt: 600,
      }),
    );
    deliver(PAGE_CONTACT_MESSAGE, page);
    await vi.waitFor(async () => expect(await loadSettingsUpdatedAt()).toBe(600));
    expect((await loadSettings()).features.ytShorts).toBe(false);
    expect(sent.map(({ message }) => message.reason)).toEqual(['page', 'page']);
  });

  it('warns when it cannot read its settings, and syncs again on the next page load', async () => {
    vi.spyOn(fakeBrowser.storage.local, 'get').mockRejectedValueOnce(new Error('storage is gone'));
    const { api, listeners, sent, deliver } = fakeApi({ answer: appAnswer() });
    startNativeBridge(api);
    listeners.startup[0]?.();
    await vi.waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('storage is gone')),
    );
    expect(sent).toHaveLength(0);

    deliver(PAGE_CONTACT_MESSAGE, { id: OWN_ID, url: 'https://m.youtube.com/' });
    await vi.waitFor(async () => expect(await loadSettingsUpdatedAt()).toBe(500));
    expect(sent).toHaveLength(1);
  });
});
