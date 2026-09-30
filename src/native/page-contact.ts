import { PAGE_CONTACT_MESSAGE } from './protocol';

/** The part of the extension API a content script needs to reach the background page. */
export interface PageContactApi {
  readonly runtime: { sendMessage(message: unknown): Promise<unknown> };
}

/**
 * Tells the background page that a supported page has loaded, so it can sync
 * with the iOS app and record that the extension is working. Nothing about the
 * page is sent. A failure only means the app hears nothing this time.
 */
export async function notifyPageContact(api: PageContactApi): Promise<void> {
  try {
    await api.runtime.sendMessage(PAGE_CONTACT_MESSAGE);
  } catch {
    // The background page is asleep or was just reloaded; the next page load tries again.
  }
}
