import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { startNativeBridge } from '../native/bridge';

export default defineBackground({
  // Safari wakes an event page when it is needed and stops it when idle.
  persistent: { safari: false },
  main() {
    if (import.meta.env.SAFARI) {
      // On iOS the settings live in the app; the toolbar button and the first-run
      // page of the desktop extension have no counterpart there.
      startNativeBridge(browser);
      return;
    }

    browser.action.onClicked.addListener(() => {
      void browser.runtime.openOptionsPage();
    });

    browser.runtime.onInstalled.addListener(({ reason }) => {
      if (reason === 'install') {
        void browser.runtime.openOptionsPage();
      }
    });
  },
});
