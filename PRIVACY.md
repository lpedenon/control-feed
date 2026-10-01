# Privacy

No Brainrot has no analytics or backend and does not collect or sell your data.
The iPhone app shares aggregate counters only when you request an export.

## Desktop browser extension

- **What it stores:** only your settings (which switches are on, and your lists
  of channels, words and topics). They live in your browser's extension storage on your
  own device.
- **What it reads:** on `youtube.com` and `instagram.com` it reads the page you
  are viewing, such as video titles and channel names, to decide what to hide.
  This happens entirely in your browser and is never recorded or sent anywhere.
- **Network:** the extension makes no network requests. It has no analytics,
  tracking or remote configuration.
- **Permissions:** `storage`, to keep your settings. Access to `youtube.com` and
  `instagram.com` pages, to hide content on them. Nothing else.

## iPhone app (in development)

The iPhone app and its Safari extension process data on the device, with no
account, server, advertising or tracking. The app offers a user-initiated
aggregate export, described below.

- **Settings** are shared between the app and its extension on the device,
  through an Apple App Group. The app also stores the extension's latest contact
  and page-contact times, reported site access, version and rule-delivery
  timestamps for status. Setup completion and your own note that the optional
  gate is set up are stored locally in the app.
- **What the extension tells the app**, using Safari's native messaging (not the
  network): its settings, its version, whether it ran on `m.youtube.com` or
  `www.youtube.com`, and whether Safari lets it read those sites. This is how the
  app shows its status. It never sends addresses, titles, channels watched or
  searches.
- **Counters** kept by the app, on the phone: YouTube address copy actions,
  saved rule changes, and hiding switches turned off in the app. Earlier app
  versions' URL handoff counts are preserved as addresses accepted by iOS,
  not confirmed Safari opens. None of these counts confirms Safari use or
  protection. The app cannot see Safari, the YouTube app or what you watch.
  **Export counters** hands only a plain-text summary of aggregate totals and
  their counting period to the iOS share sheet when you tap it, not your rules,
  extension-contact history or browsing content. You choose where to share it.
- **Permissions:** `storage` and `nativeMessaging`, plus access to
  `youtube.com` pages that you grant in Safari.

Questions: open an issue at https://github.com/lpedenon/no-brainrot/issues.
