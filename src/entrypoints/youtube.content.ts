import { defineContentScript } from 'wxt/utils/define-content-script';
import { runSite } from '../core/bootstrap';
import { youtubeSiteFor } from '../sites/youtube/select';

export default defineContentScript({
  matches: ['https://www.youtube.com/*', 'https://m.youtube.com/*'],
  runAt: 'document_start',
  main: (ctx) => runSite(ctx, youtubeSiteFor(window.location.hostname)),
});
