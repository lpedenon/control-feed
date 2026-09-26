# Control Feed

[![CI](https://github.com/lpedenon/control-feed/actions/workflows/ci.yml/badge.svg)](https://github.com/lpedenon/control-feed/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/lpedenon/control-feed)](https://github.com/lpedenon/control-feed/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Choose what you see on YouTube and Instagram. Control Feed removes the
endless-scroll surfaces built to keep you watching, such as Shorts, Reels,
recommendations and the home feed. It also filters videos by the channels and
words you pick, so what's left is what you came for.

![YouTube's home page with the feed replaced by a short message](docs/images/youtube-home.png)

## What it does

**YouTube**

- Hides the home feed, Shorts, Explore and Trending, the recommendations next to
  the video, and end-of-video suggestions. Comments can be hidden too.
- Opens any Shorts link in the regular player.
- Filters videos on the home page, in search, next to videos and on channel
  pages:
  - **Blocked channels** never show.
  - **Blocked words** hide videos whose title contains them, as whole words, in
    any capitalization.
  - **Allowed channels** are never hidden by blocked words. Turn on *Only show
    videos from allowed channels* and nothing else shows at all.

**Instagram** (early support)

- Opens the Following feed (people you follow, newest first) instead of the
  suggested feed.
- Hides Reels, the grid of recommended posts under Search, and suggested
  accounts. Search, messages and reels someone sends you still work.

Every setting is a switch, and changes apply to open tabs right away.

<img src="docs/images/settings.png" alt="The Control Feed settings page" width="560">

## Install

Control Feed is not in the Chrome Web Store or Firefox Add-ons yet. Install it
from a release.

### Chrome, Edge, Brave, Arc and other Chromium browsers

1. Download `control-feed-<version>-chrome.zip` from the
   [latest release](https://github.com/lpedenon/control-feed/releases/latest)
   and unzip it.
2. Open `chrome://extensions` (in Edge, `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the unzipped folder.

Keep that folder, because the browser loads the extension from it. To update,
replace the folder's contents with a newer release and click the reload icon on
the extension's card.

### Firefox

Firefox only installs add-ons permanently once Mozilla has signed them, which
happens when they are published on Firefox Add-ons. Until then you can try it
for one session:

1. Download `control-feed-<version>-firefox.zip` from the
   [latest release](https://github.com/lpedenon/control-feed/releases/latest).
2. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary
   Add-on…** and pick the zip.

It stays installed until you restart Firefox.

## Use it

Click the Control Feed icon in the toolbar to open its settings. Everything is on
by default except hiding comments.

For a learning-only YouTube, add the channels you learn from under **Allowed
channels** and turn on **Only show videos from allowed channels**.

## Good to know

- It works in desktop browsers. The YouTube and Instagram phone apps are not
  affected.
- YouTube and Instagram change their pages from time to time, which can let
  something slip through. If it does, please
  [open an issue](https://github.com/lpedenon/control-feed/issues/new/choose).
- Instagram support is newer and less tested than YouTube.

## Privacy

Control Feed collects nothing and makes no network requests. Your settings stay
in your browser. See [PRIVACY.md](PRIVACY.md).

## Contributing

Bug reports, ideas and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md)
explains how to build it, run the tests and fix a page after a site changes.

To build from source: `pnpm install && pnpm build`, then load
`.output/chrome-mv3` as described above.

## License

[MIT](LICENSE) © lpedenon
