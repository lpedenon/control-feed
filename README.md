# Control Feed

A browser extension that lets you decide what you see on YouTube and Instagram.
It removes the endless-scroll surfaces (Shorts, Reels, recommendations, the
home feed) and filters videos by the channels and words you choose.

## What it does

**YouTube**

- Hides the home feed, Shorts, Explore/Trending, the recommendations next to
  the player, end-of-video suggestions and (optionally) comments.
- Opens any Shorts link in the regular player.
- Filters videos everywhere (home, search, next to videos, channel pages) by:
  - **Blocked channels**: never shown.
  - **Blocked words in titles**: whole-word, case- and accent-insensitive.
  - **Allowed channels**: never hidden by blocked words. With
    *Only show videos from allowed channels* on, nothing else is shown.

**Instagram**

- Opens the Following feed (accounts you follow, newest first) instead of the
  suggested home feed.
- Hides Reels and Explore, sending those pages back to your feed. Search and
  reels someone sends you still work.
- Hides suggested accounts.

Every switch applies to open tabs immediately.

## Install

```bash
pnpm install
pnpm build
```

Then in Chrome, Arc or Brave open `chrome://extensions`, turn on
**Developer mode**, click **Load unpacked** and pick `.output/chrome-mv3`.
Click the extension icon to open the settings.

For Firefox: `pnpm build:firefox`, then load `.output/firefox-mv2/manifest.json`
from `about:debugging`.

## Develop

| Command | What it does |
| --- | --- |
| `pnpm dev` | Opens a browser with the extension, reloading on change |
| `pnpm check` | Typecheck, lint and unit tests |
| `pnpm test:coverage` | Unit tests with coverage (80% minimum) |
| `pnpm test:e2e` | Builds, then runs the extension in Chromium against captured pages |
| `pnpm test:live` | Builds, then runs the extension against the real sites |

## How it works

```
src/
  core/            site-independent engine
    features.ts      every switch the extension offers (the options page renders from it)
    settings.ts      settings shape, defaults, validation, immutable updates
    stylesheet.ts    settings -> CSS that hides things before they paint
    tile-filter.ts   watches the page and marks tiles your filters reject
    site-runner.ts   ties styles, redirects and filtering together per site
  sites/youtube/   hide rules, redirects, tile parsing and filter policy
  sites/instagram/ hide rules and redirects
  options/         settings page
  entrypoints/     content scripts, background worker, options page
```

Hiding is done with CSS injected at `document_start`, so hidden content never
flashes on screen. Defaults apply instantly and your stored settings replace
them a few milliseconds later. Filtering reads each video tile's title and
channel, marks rejected tiles with a `data-control-feed-hidden` attribute
(its value says why) and lets the stylesheet hide them.

## When a site changes its layout

Sites rename their markup from time to time. Selectors avoid generated class
names and rely on tag names, link targets and accessibility labels, which are
more stable, but they can still break. To update:

1. `node e2e/tools/capture-youtube-fixtures.ts` saves fresh page snapshots to
   `e2e/fixtures/youtube/`.
2. `pnpm test` and `pnpm test:e2e` show what no longer matches.
3. `pnpm test:live` confirms the fix against the real site. Screenshots land
   in `.screens/` for a visual check.

Live Instagram tests need a logged-in session: run
`node e2e/tools/instagram-login.ts` once and log in in the window that opens.
The session stays in `e2e/.auth/` (git-ignored).
