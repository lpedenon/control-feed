# Contributing

Thanks for helping. The most valuable contributions are usually small: a
selector that stopped matching after YouTube changed its layout, or a new
distraction worth hiding.

## Unfinished work

**Instagram support is unfinished.** Hashtag pages get through, and only the
desktop layout in English has been checked. Issue
[#2](https://github.com/lpedenon/no-brainrot/issues/2) lists what works, what
does not, what was never tested and where to start. The failing case is kept
as a `test.fixme` in `e2e/instagram.live.spec.ts`.

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
| `pnpm test:e2e` | Builds, then runs the extension in Chromium against captured pages, desktop and iPhone-sized |
| `pnpm ios:test` | The Swift package's tests (macOS with the Swift toolchain) |
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
    topics.ts        built-in topics (AI, Gaming…) and the words that recognize them
    stylesheet.ts    settings -> CSS that hides things before they paint
    tile-filter.ts   watches the page and marks tiles your filters reject
    site-runner.ts   ties styles, redirects and filtering together per site
  sites/youtube/   hide rules, redirects, tile parsing and filter policy
    mobile/          the same for m.youtube.com, which has its own page structure
  sites/instagram/ hide rules and redirects
  options/         settings page
  native/          the Safari extension's link to the iOS app (see below)
  entrypoints/     content scripts, background worker, settings page, Safari popup
ios/               the iPhone app that packages the Safari build (see below)
```

- Hiding is done with CSS injected at `document_start`, so hidden content never
  flashes on screen. Defaults apply instantly and stored settings replace them
  a few milliseconds later.
- Filtering reads each video tile's title and channel and marks rejected tiles
  with a `data-no-brainrot-hidden` attribute whose value says why. The
  stylesheet does the hiding.
- Settings are never mutated: every change produces a new object.

To add a switch, add it to `src/core/features.ts`, then give it hide rules or a
redirect in the site's folder. The settings page picks it up automatically.

## iPhone app (Safari)

`ios/` packages the Safari Web Extension and its native settings screen.
For supported behavior, setup and the voluntary gate, see the
[README's iPhone guide](README.md#iphone-app-in-development); data handling is
owned by [PRIVACY.md](PRIVACY.md#iphone-app-in-development).

```
ios/
  project.yml            XcodeGen spec; the Xcode project is generated, not committed
  Config/Shared.xcconfig bundle ids, App Group and version (placeholders until the app is enrolled)
  App/                   SwiftUI app: status, rules, the Shortcuts gate, help, first-run setup
  Extension/             the Safari extension's native handler
  Packages/NoBrainrotKit settings model, sync, status logic and their Swift tests
  Scripts/               copies the built web extension into the extension bundle
```

How it fits together:

- `pnpm build:safari` builds the web extension for Safari (`.output/safari-mv2`).
  It is the same code as the desktop build, plus a bridge in `src/native/`: the
  extension cannot be pushed to by the app, so it pulls settings through the
  protocol owned by `src/native/protocol.ts`. For reconciliation rules, see
  `src/native/sync.ts` and the Swift `SyncService`. Native status logic and
  wording live in
  `ios/Packages/NoBrainrotKit/Sources/NoBrainrotKit/Status.swift`.
- The Swift package repeats the settings rules. `pnpm ios:contract` generates
  `ContractData.swift` and the test vectors from the TypeScript, and both
  test suites check their own code against them. Run it after changing
  `src/core/features.ts`, `topics.ts`, `settings.ts` or the protocol, and commit the result.
  Do not edit the generated files by hand.
- `pnpm ios:project` builds the web extension and generates `ios/NoBrainrot.xcodeproj`
  (install [XcodeGen](https://github.com/yonaskolb/XcodeGen) first). Open it in
  Xcode, pick a team under Signing for both targets, register their shared App
  Group as described in `ios/Config/Shared.xcconfig`, and run on a device.
  Then follow the [user setup steps](README.md#iphone-app-in-development).

What is checked where. The web unit tests and Chromium tests run with the web
toolchain; `pnpm test:e2e` loads the Safari flavour as MV3 with an iPhone user
agent and a stand-in for the app. Swift package tests require macOS and Swift
as declared in `ios/Packages/NoBrainrotKit/Package.swift`; they do not compile
`ios/App/`. The CI `ios` job also builds the app for the iOS Simulator without
signing and inspects the result.
Nothing runs the app or Safari's own extension host in CI: how Safari grants
site access, wakes the background page and hands over native messages, the
Shortcuts gate, and the layout on a real iPhone still need a person with a
device. The manual copy/paste flow and the automation with a non-Safari default
browser or YouTube Universal Links have not been validated on an iPhone.
Package tests check copy signals and emitted instructions, not iOS routing.

## When a site changes its layout

Selectors avoid generated class names and rely on tag names, link targets and
accessibility labels, which change less often. When one breaks:

1. `node e2e/tools/capture-youtube-fixtures.ts` saves fresh snapshots of
   YouTube pages to `e2e/fixtures/youtube/`; add `--mobile` for the phone site
   (`e2e/fixtures/youtube-mobile/`).
2. `pnpm test` and `pnpm test:e2e` show what no longer matches.
3. Fix the rule in `src/sites/<site>/` (`mobile/` for the phone site), then
   confirm with `pnpm test:live`.

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

Also update `MARKETING_VERSION` in `ios/Config/Shared.xcconfig`; the CI `ios`
job fails if the built app's version differs from `package.json`.

The Release workflow checks that the tag matches `package.json`, runs web
typechecking, lint, unit and fixture E2E checks, builds the Chrome and Firefox
packages and publishes them on a GitHub release. It does not run Swift tests,
build or publish the iPhone app.
