import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Explicit imports keep every module readable and testable on its own.
  imports: false,
  manifest: ({ browser }) => ({
    name: 'Control Feed',
    description:
      'Hide Shorts, Reels, recommendations and anything else you did not choose to see on YouTube and Instagram.',
    permissions: ['storage'],
    action: {
      default_title: 'Control Feed settings',
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'control-feed@extension',
              // Settings stay in the browser; nothing is collected or sent.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
