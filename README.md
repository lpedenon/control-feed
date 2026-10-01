<p align="center">
  <img src="assets/icon.svg" alt="No Brainrot logo: a melting brain under a no sign" width="112">
</p>

<h1 align="center">No Brainrot</h1>

<p align="center"><strong>Take back your attention on YouTube and Instagram.</strong></p>

<p align="center">
  <a href="https://github.com/lpedenon/no-brainrot/actions/workflows/ci.yml"><img src="https://github.com/lpedenon/no-brainrot/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/lpedenon/no-brainrot/releases/latest"><img src="https://img.shields.io/github/v/release/lpedenon/no-brainrot" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a>
</p>

No Brainrot is a free browser extension that removes the parts of YouTube and
Instagram built to keep you scrolling: Shorts, Reels, recommendations and the
endless home feed. Pick the channels and topics you care about and filter out
the rest, so you get the video you came for, not the next hour of scrolling.

- **Stop the scroll.** Shorts, Reels, the home feed and "up next" suggestions
  disappear.
- **See only what you pick.** Block channels and words, or allow only the
  channels you learn from.
- **Instant in desktop browsers.** Settings changes update open tabs right away.
- **Private.** No account and no tracking. See [PRIVACY.md](PRIVACY.md).
- **Free and open source.** MIT licensed.

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
  - **Allowed channels** bypass blocked words and topic filters, but blocked
    channels still win. With Topics off, turn on *Only show videos from allowed
    channels* to hide everything else. If an *Only show videos about these topics*
    filter is also on, videos matching those topics can show too.
  - **Topics** such as AI, Gaming or Sports: either show *only* videos about
    the topics you pick, or hide videos about them. A topic is a list of words
    looked for in video titles. Common topics come with a starter list you can
    edit, and you can make your own.

**Instagram** (unfinished)

- Opens the Following feed (people you follow, newest first) instead of the
  suggested feed.
- Hides Reels, the grid of recommended posts under Search, place pages and
  suggested accounts. Search, messages and reels someone sends you still work.
- **Not done yet:** hashtag pages still show a grid of posts from anyone, and
  only the desktop layout in English has been checked. What is left is tracked
  in [#2](https://github.com/lpedenon/no-brainrot/issues/2).

<img src="docs/images/settings.png" alt="The No Brainrot settings page" width="560">

## Install

No Brainrot is not in the Chrome Web Store or Firefox Add-ons yet. Install it
from a release.

### Chrome, Edge, Brave, Arc and other Chromium browsers

1. Download the file ending in `-chrome.zip` from the
   [latest release](https://github.com/lpedenon/no-brainrot/releases/latest)
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

1. Download the file ending in `-firefox.zip` from the
   [latest release](https://github.com/lpedenon/no-brainrot/releases/latest).
2. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary
   Add-on…** and pick the zip.

It stays installed until you restart Firefox.

## Use it

Click the No Brainrot icon in the toolbar to open its settings. Everything is on
by default except hiding comments.

For a learning-only YouTube, add the channels you learn from under **Allowed
channels** and turn on **Only show videos from allowed channels**.

To watch only one kind of video, say AI, add the **AI** topic under **Topics**
and choose **Only show videos about these topics**. To keep a topic away
instead, such as gaming, add it and choose **Hide videos about these topics**.
Topics go by the words in video titles, so add any word your topic's videos use
that the list is missing.

Channel lists accept display names, full `@handles`, channel IDs and channel
URLs, including URL-encoded handles. When YouTube supplies a handle, an
`@handle` rule matches that complete handle, not a different publisher with the
same display name. If only a display name is available, it falls back to name
matching, which is less precise.

### iPhone app (in development)

The unreleased iPhone app packages the YouTube extension for Safari. It keeps
search, channel pages, selected videos and playback available while hiding
distracting surfaces. Instagram is not part of
this app. For a development build, see
[CONTRIBUTING.md](CONTRIBUTING.md#iphone-app-safari).

1. Follow the first-run setup: in Settings, open Apps, Safari, Extensions,
   No Brainrot and enable it. On iOS 17, Safari is directly under Settings.
2. Open `m.youtube.com` in Safari. From the address bar's aA/extension menu,
   choose No Brainrot and allow it on YouTube. Enabling and granting access
   are your actions; the app cannot do them for you.
3. Use **Copy YouTube address** in the app, open Safari yourself, then paste
   `https://m.youtube.com/` into its address bar. Copying does not open Safari.
4. Edit channel, word, topic and hiding controls in **Rules**. Changes reach
   the extension on its next startup or YouTube page load, not immediately
   from the app. The extension popup's **Open the app** link returns to Rules.

**Status** reports what the extension last said about page activity, site
access and rule delivery, not ongoing protection. Missing or unknown access
is not confirmation that filtering is on. **Help** explains the limits.
Requesting the desktop site uses the desktop rules and also needs permission
for `www.youtube.com`.

**Gate** offers a voluntary Shortcuts app-opened automation using **Open URLs**.
It does not force Safari: the default browser or native YouTube app may open
instead. Check its destination yourself; if it is not Safari, turn it off and
use the manual steps above. The app cannot create or verify the automation,
and it is a nudge, not a lock. Gate also explains YouTube's optional **Shorts
feed limit**: in the YouTube app, look under You, Settings, Time management,
then set it to 0 minutes if available. This is YouTube's dismissible reminder,
not a No Brainrot block; availability and menu names vary.

**Export counters** in Status shares only local aggregate totals and their
counting period, when you request it. See [PRIVACY.md](PRIVACY.md#iphone-app-in-development)
for what is counted and stored.

## Good to know

- It works in desktop browsers and, in the unreleased
  [iPhone app](#iphone-app-in-development), Safari. Neither changes the native
  YouTube or Instagram apps. YouTube's own **Open App** button can still take
  you out of Safari, and anyone with your phone can disable the extension.
- YouTube and Instagram change their pages from time to time, which can let
  something slip through. If it does, please
  [open an issue](https://github.com/lpedenon/no-brainrot/issues/new/choose).
- Instagram support is unfinished (see above). You can switch it off in the
  settings and keep only YouTube.

## Privacy

See [PRIVACY.md](PRIVACY.md) for local storage, Safari/app communication and
optional counter sharing.

## Contributing

Bug reports, ideas and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md)
explains how to build it, run the tests and fix a page after a site changes.

To build from source: `pnpm install && pnpm build`, then load
`.output/chrome-mv3` as described above.

## License

[MIT](LICENSE) © lpedenon
