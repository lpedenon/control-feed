import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  // Explicit imports keep every module readable and testable on its own.
  imports: false,
  zip: {
    // The sources zip goes to Firefox Add-ons review: never include local test
    // output or the logged-in Instagram test session.
    excludeSources: [
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '.screens/**',
      'e2e/.auth/**',
    ],
  },
  manifest: ({ browser }) => ({
    name: 'No Brainrot',
    description:
      'Take back your attention. Hide Shorts, Reels, recommendations and endless feeds on YouTube and Instagram.',
    homepage_url: 'https://github.com/lpedenon/control-feed',
    permissions: ['storage'],
    action: {
      default_title: 'No Brainrot settings',
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'no-brainrot@extension',
              // Settings stay in the browser; nothing is collected or sent.
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
