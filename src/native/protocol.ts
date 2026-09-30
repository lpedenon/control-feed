import { z } from 'zod';
import { parseSettings, type Settings } from '../core/settings';

/**
 * How the Safari extension and the iOS app talk to each other. The app cannot
 * push anything into the extension, so the extension asks: it sends what it
 * holds and gets back what the app holds, and the later change wins.
 *
 * Bump this on any change the other side would misread. The Swift side lives in
 * ios/Packages/NoBrainrotKit and is checked against ios/Contract/contract.json.
 */
export const PROTOCOL_VERSION = 1;

/** The pages the iOS extension is meant to run on. */
export const SITE_HOSTS = ['m.youtube.com', 'www.youtube.com'] as const;
export type SiteHost = (typeof SITE_HOSTS)[number];

/** What Safari says about the extension's access to a site, or that it could not say. */
export const SITE_ACCESS_VALUES = ['granted', 'not-granted', 'unknown'] as const;
export type SiteAccess = (typeof SITE_ACCESS_VALUES)[number];

/**
 * Why the extension is getting in touch: its background page started, or a
 * content script ran on a supported page (the stronger sign that it works).
 */
export const CONTACT_REASONS = ['startup', 'page'] as const;
export type ContactReason = (typeof CONTACT_REASONS)[number];

/**
 * Sent to the app. It carries the extension's settings and version, what Safari
 * reports about site access and, for `page`, which site a content script just
 * ran on. It never carries a URL, a title or anything else about what is watched.
 */
export interface SyncRequest {
  readonly type: 'sync';
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly extensionVersion: string;
  readonly reason: ContactReason;
  readonly settings: Settings;
  readonly settingsUpdatedAt: number;
  readonly siteAccess: Readonly<Record<SiteHost, SiteAccess>>;
  readonly pageHost: SiteHost | null;
}

const acceptedResponse = z.object({
  ok: z.literal(true),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  appVersion: z.string().catch('unknown'),
  settings: z
    .unknown()
    .optional()
    .transform((value) => (value == null ? null : parseSettings(value))),
  settingsUpdatedAt: z.number().finite().nonnegative().catch(0),
});

const rejectedResponse = z.object({
  ok: z.literal(false),
  error: z.string().catch('unknown'),
});

export type SyncResponse =
  | {
      readonly ok: true;
      readonly appVersion: string;
      /** The app's settings, or null when it has none yet. */
      readonly settings: Settings | null;
      readonly settingsUpdatedAt: number;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Checks what came back from the app. Anything that is not a well-formed
 * answer in this protocol version is refused rather than guessed at.
 */
export function parseSyncResponse(raw: unknown): SyncResponse | null {
  const accepted = acceptedResponse.safeParse(raw);
  if (accepted.success) {
    const { appVersion, settings, settingsUpdatedAt } = accepted.data;
    return { ok: true, appVersion, settings, settingsUpdatedAt };
  }
  const rejected = rejectedResponse.safeParse(raw);
  return rejected.success ? { ok: false, error: rejected.data.error } : null;
}

/** Sent by a content script to the background page: "a supported page just loaded". */
export const PAGE_CONTACT_MESSAGE = 'no-brainrot:page-contact';

export function isSiteHost(value: string): value is SiteHost {
  return (SITE_HOSTS as readonly string[]).includes(value);
}
