import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/settings';
import { isSiteHost, PROTOCOL_VERSION, parseSyncResponse } from './protocol';

const accepted = {
  ok: true,
  protocolVersion: PROTOCOL_VERSION,
  appVersion: '1.0',
  settings: DEFAULT_SETTINGS,
  settingsUpdatedAt: 10,
};

describe('parseSyncResponse', () => {
  it('accepts a well-formed answer', () => {
    expect(parseSyncResponse(accepted)).toEqual({
      ok: true,
      appVersion: '1.0',
      settings: DEFAULT_SETTINGS,
      settingsUpdatedAt: 10,
    });
  });

  it('treats a missing or null settings document as "none yet"', () => {
    expect(parseSyncResponse({ ...accepted, settings: null })).toMatchObject({ settings: null });
    const { settings: _omitted, ...withoutSettings } = accepted;
    expect(parseSyncResponse(withoutSettings)).toMatchObject({ settings: null });
  });

  it('repairs a damaged settings document field by field', () => {
    const answer = parseSyncResponse({
      ...accepted,
      settings: { features: { ytShorts: 'maybe', ytComments: true } },
    });
    expect(answer).toMatchObject({ ok: true });
    if (answer?.ok !== true || answer.settings === null) throw new Error('expected settings');
    expect(answer.settings.features.ytShorts).toBe(true);
    expect(answer.settings.features.ytComments).toBe(true);
  });

  it('falls back on an unusable timestamp or version label', () => {
    expect(
      parseSyncResponse({ ...accepted, settingsUpdatedAt: 'now', appVersion: 3 }),
    ).toMatchObject({ settingsUpdatedAt: 0, appVersion: 'unknown' });
    expect(parseSyncResponse({ ...accepted, settingsUpdatedAt: -1 })).toMatchObject({
      settingsUpdatedAt: 0,
    });
  });

  it('refuses another protocol version', () => {
    expect(parseSyncResponse({ ...accepted, protocolVersion: PROTOCOL_VERSION + 1 })).toBeNull();
  });

  it('passes on a refusal from the app', () => {
    expect(parseSyncResponse({ ok: false, error: 'unsupported-protocol' })).toEqual({
      ok: false,
      error: 'unsupported-protocol',
    });
    expect(parseSyncResponse({ ok: false })).toEqual({ ok: false, error: 'unknown' });
  });

  it.each([undefined, null, 'ok', 5, [], {}, { ok: 'yes' }])('refuses %j', (raw) => {
    expect(parseSyncResponse(raw)).toBeNull();
  });
});

describe('isSiteHost', () => {
  it('knows the supported hosts only', () => {
    expect(isSiteHost('m.youtube.com')).toBe(true);
    expect(isSiteHost('www.youtube.com')).toBe(true);
    expect(isSiteHost('evil.example')).toBe(false);
    expect(isSiteHost('youtube.com')).toBe(false);
  });
});
