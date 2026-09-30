import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { runSite } from '../core/bootstrap';
import { notifyPageContact } from '../native/page-contact';
import { youtubeSiteFor } from '../sites/youtube/select';

export default defineContentScript({
  matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
  runAt: 'document_start',
  main: (ctx) => {
    // The iOS app learns that the extension is working from this.
    if (import.meta.env.SAFARI) void notifyPageContact(browser);
    return runSite(ctx, youtubeSiteFor(window.location.hostname));
  },
});
