# Contributing

Thanks for helping. The most valuable contributions are usually small: a
selector that stopped matching after YouTube changed its layout, or a new
distraction worth hiding.

## Set up

You need Node.js 22.18 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # opens Chrome with the extension, reloading on change
pnpm dev:firefox  # same for Firefox
```

## Before you open a pull request

| Command | What it checks |
| --- | --- |
| `pnpm check` | Typecheck, lint (Biome) and unit tests |
| `pnpm test:coverage` | Unit tests with coverage (80% minimum) |
| `pnpm test:e2e` | Builds, then runs the extension in Chromium against captured pages |
| `pnpm test:live` | Builds, then runs the extension against the real sites |

CI runs everything except `test:live`, because the real sites throttle CI
machines. If your change affects what gets hidden, run `pnpm test:live`
yourself and look at the screenshots it saves in `.screens/`.

`pnpm lint:fix` formats the code and fixes what it can.

## How it is built

```
src/
  core/            site-independent engine
    features.ts      every switch the extension offers (the settings page renders from it)
    settings.ts      settings shape, defaults, validation, immutable updates
    stylesheet.ts    settings -> CSS that hides things before they paint
    tile-filter.ts   watches the page and marks tiles your filters reject
    site-runner.ts   ties styles, redirects and filtering together per site
  sites/youtube/   hide rules, redirects, tile parsing and filter policy
  sites/instagram/ hide rules and redirects
  options/         settings page
  entrypoints/     content scripts, background worker, settings page
```

- Hiding is done with CSS injected at `document_start`, so hidden content never
  flashes on screen. Defaults apply instantly and stored settings replace them
  a few milliseconds later.
- Filtering reads each video tile's title and channel and marks rejected tiles
  with a `data-control-feed-hidden` attribute whose value says why. The
  stylesheet does the hiding.
- Settings are never mutated: every change produces a new object.

To add a switch, add it to `src/core/features.ts`, then give it hide rules or a
redirect in the site's folder. The settings page picks it up automatically.

## When a site changes its layout

Selectors avoid generated class names and rely on tag names, link targets and
accessibility labels, which change less often. When one breaks:

1. `node e2e/tools/capture-youtube-fixtures.ts` saves fresh snapshots of
   YouTube pages to `e2e/fixtures/youtube/`.
2. `pnpm test` and `pnpm test:e2e` show what no longer matches.
3. Fix the rule in `src/sites/<site>/`, then confirm with `pnpm test:live`.

Live Instagram tests need a logged-in session. Run
`node e2e/tools/instagram-login.ts` once and log in in the window that opens.
The session stays in `e2e/.auth/`, which git ignores.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org):
`feat: hide YouTube Playables`, `fix: keep search results on Instagram Explore`.
Release notes are written from them.

## Releasing

1. Update `version` in `package.json` and commit (`chore: release 0.2.0`).
2. Create an annotated tag whose message becomes the release notes:
   `git tag -a v0.2.0` (write the highlights in the editor).
3. `git push --follow-tags`.

The Release workflow checks that the tag matches `package.json`, runs every
test, builds the Chrome and Firefox packages and publishes them on a GitHub
release.
