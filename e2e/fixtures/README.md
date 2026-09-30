# Test fixtures

Trimmed snapshots of public youtube.com pages, captured while signed out with
`node e2e/tools/capture-youtube-fixtures.ts`. Scripts, styles and media are
removed; only page structure and text remain.

- `youtube/` is the desktop site (www.youtube.com).
- `youtube-mobile/` is the phone site (m.youtube.com) as YouTube serves it to
  an iPhone user agent, captured with `--mobile`. It has its own page
  structure (`ytm-*` elements), so it has its own rules.

They exist so tests can check hiding and filtering against YouTube's real page
structure without the network. The content belongs to YouTube and the
respective creators and is not covered by this project's license.
