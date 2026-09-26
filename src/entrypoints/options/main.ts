import { loadSettings, saveSettings, watchSettings } from '../../core/settings-store';
import { startOptions } from '../../options/controller';

async function main(): Promise<void> {
  const root = document.getElementById('options');
  if (!root) throw new Error('Options root element is missing.');
  try {
    const stop = await startOptions(root, {
      load: loadSettings,
      save: saveSettings,
      watch: watchSettings,
    });
    // Flush an edit still waiting to be saved when the tab closes.
    window.addEventListener('pagehide', stop, { once: true });
  } catch (error) {
    console.error('[Control Feed] Settings page failed to start.', error);
    root.textContent = 'Could not load your settings. Try reloading this page.';
  } finally {
    root.removeAttribute('aria-busy');
  }
}

void main();
