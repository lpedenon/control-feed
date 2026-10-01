import { defineContentScript } from 'wxt/utils/define-content-script';
import { runSite } from '../core/bootstrap';
import { instagramSite } from '../sites/instagram';

export default defineContentScript({
  // The iOS app supports YouTube only for now.
  exclude: ['safari'],
  matches: ['https://www.instagram.com/*'],
  runAt: 'document_start',
  main: (ctx) => runSite(ctx, instagramSite),
});
