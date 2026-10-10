# Stage

Stage is a private, encrypted messenger built on XMTP, with group channels,
multi-account support, free onchain names and avatars (`*.stage.base.eth` on
Base), and a smart-account wallet (assets, balances, transfers,
recovery phrase backup). It ships as **one universal Expo app** serving Android, iOS,
web, desktop and a Chrome side-panel extension from the same React Native codebase (web via
react-native-web), backed by a framework-agnostic TypeScript core, a
design-system kit, a Cloudflare Worker and a push-notification server.

## Monorepo layout

```
apps/
  stage/      # stage — the universal Expo + React Native app (android · ios · web · desktop)
              #   app/         expo-router file routes (routes only — helpers live in components/)
              #   components/  kit-JSX screens + colocated *.model.ts pure models, one folder per family
              #   lib/         state + SDK orchestration (incl. the xmtp.*.web adapters and *.core.ts)
              #   modules/     messaging/ (rows, queries, feed, consent; no barrel) + the stage-pill native module
              #   platform/    storage seams (.ts native / .web.ts overrides)
              #   test/        pure-model tests (bun test)
              #   desktop/     Electron shell that bundles the web export (nested workspace)
              #   extension/   Chrome Manifest V3 shell around the same web export
  proxy/      # Cloudflare Worker: link previews, image resize, x402, XMTP history/push relays,
              #   the *.stage.base.eth names service, user node publishing (/nodes), and the
              #   bundler.stage.box manifest proxy
  dispatch/   # Cloudflare Worker on nodes.stage.box: runs the nodes users publish, each in its own
              #   Workers for Platforms sandbox (no node code in this repo)
  push/       # XMTP notification server (upstream image, deployed to Fly as stage-push)
packages/
  client/     # @stage-labs/client — framework-agnostic shared logic (XMTP cores + codecs,
              #   identity/names, wallet, accounts + zerodev, read-only APIs, x402)
  kit/        # @stage-labs/kit — design system: tokens, icons, theme contracts,
              #   and one React Native component family (renders on web via RNW)
  config/     # @stage-labs/config — shared TS/knip/madge presets, oxlint JS plugins + the stage CLI
```

Each workspace has its own README with details; `CLAUDE.md` is the
architecture guide.

## Prerequisites

- [Bun](https://bun.sh) `1.4.0` (pinned via the `packageManager` field) — the only package manager
- Node.js `>= 22` (per the `engines` field)

## Install

```sh
bun install
```

## Common commands

Run from the repo root:

```sh
bun run build       # turbo run build
bun run test        # turbo run test
bun run test:changed  # test only the packages changed since origin/main and their dependents
bun run typecheck   # stage typecheck (tsgo, TypeScript 7, per workspace)
bun run typecheck:tsc  # the same with tsc from TypeScript 5.9 (fallback)
bun run lint        # stage lint (oxlint with type-aware rules over the whole repo)
bun run lint:fix    # stage lint --fix
bun run lint:changed  # lint only the files changed since the upstream branch
bun run check       # lint + typecheck
bun run knip        # unused files / deps / exports
bun run madge       # circular-dependency check
```

`stage lint` runs `oxlint --type-aware` with the root `.oxlintrc.json`: the
type-aware rules run through `oxlint-tsgolint`, and the rules oxlint does not
have natively (no comments, no em dash, `stage/*`, `no-restricted-syntax`,
`quotes`) run as JS plugins. It skips git-ignored files. `stage lint <paths>`
lints only those paths. CI always runs the full lint, because a type change in
one file can create findings in another.

`stage/no-custom-font-size` requires named Kit font sizes in Stage's `app`,
`components`, `lib`, `modules` and `platform` JS/TS source. It checks object and
StyleSheet properties, assignments, JSX font-size props and CSS font declarations
in strings. Native inputs and Markdown body sizing can use `FONT_SIZE` or
`fontSize()` imported from Kit. Imported Kit `Text` (including aliases) must use
`size`, not a style override, even when that override contains a token. The check
follows local const aliases and destructuring, static computed keys, arrays,
spreads, branches and `StyleSheet.create` / `flatten`. Direct arithmetic writes
are rejected; destructuring reads are not declarations. CSS-like strings are
checked at declaration boundaries, not by matching ordinary prose. This is not
cross-module or runtime data-flow analysis of arbitrary wrappers, functions,
mutations, dynamic property keys or generated CSS. Kit's semantic Title, wallet
and computed Markdown styles, test fixtures and standalone HTML support pages
are outside this app rule. Existing Kit-specific lint rules still apply there.
The CLI/config regression suite lives in `apps/stage/scripts/test`, separate
from the app's pure-model `test` directory. Run it with
`bun test apps/stage/scripts/test/typographyLint.test.mjs`; CI's Test step runs
this suite before the workspace tests.

Tasks are orchestrated by [Turbo](https://turbo.build); see `turbo.json` for the
pipeline (`build`, `test`, `typecheck`).

Per-app dev servers and builds:

```sh
bun --cwd apps/stage start              # Expo bundler (Metro)
bun --cwd apps/stage android            # build + run on Android
bun --cwd apps/stage ios                # build + run on iOS
bun --cwd apps/stage web                # run the app in a browser
bun --cwd apps/stage run build:web      # web export (Netlify publishes dist/, config in apps/stage/netlify.toml)
bun --cwd apps/proxy dev                # Cloudflare Worker (wrangler dev)
bun --cwd apps/dispatch dev             # the nodes.stage.box dispatch Worker (wrangler dev)
bun run --cwd apps/stage/desktop start  # Electron desktop app with the bundled web UI
bun run --cwd packages/kit storybook    # gallery of every kit component (Vite, port 6006)
```

## Environment

`apps/stage` reads `EXPO_PUBLIC_*` vars at build time (inlined by Expo, so every
value is public). Set them in the Netlify site (web) and the EAS build profiles
(`eas.json`, mobile); secrets never go in `eas.json` or the repo.

| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_ZERODEV_PROJECT_ID` | ZeroDev smart-account project (Base) |
| `EXPO_PUBLIC_ZERODEV_RPC` | Optional RPC override for the smart-account client |
| `EXPO_PUBLIC_LINKPROXY_URL` | Base URL of the proxy Worker (default `https://proxy.stage.box`) |
| `EXPO_PUBLIC_PUSH_SERVER_URL` | Push server base URL |

Attachments (already client-side encrypted) upload to the proxy Worker
(`POST /attachments`), which stores the ciphertext in the `stage` R2 bucket
as `attachments/<random id>` and serves it back from
`proxy.stage.box/attachments/<id>`. Messages from before the move carry Swarm
links (`/bzz/<ref>/`), which the app reads from the public Swarm gateway
(`download.gateway.ethswarm.org`).

## Releases

- **Web:** Netlify builds `bun run build:web` from `apps/stage` on every push to `main`.
- **Mobile:** bumping `version` in `apps/stage/app.config.js` triggers
  `release-mobile.yml` (EAS Build + Submit to Play and TestFlight); every push
  publishes a JS-OTA dev-client preview. See `docs/mobile-release.md`.
- **Desktop:** the same version bump runs `release-desktop.yml`, which builds the
  macOS / Windows / Linux installers and publishes them to the GitHub Release
  that the landing page links to. See `docs/desktop-release.md`.
- **Chrome extension:** `bun scripts/build-extension.mjs` builds an unpacked beta. PR builds attach it as an Actions artifact, without publishing to the Chrome Web Store. See `docs/chrome-extension.md`.
- **Proxy / dispatch / push:** the proxy and dispatch Workers deploy through Cloudflare Workers Builds on push to `main` (typecheck and tests run first); `deploy-push-server.yml` deploys the push server.

## CI / quality gates

CI runs on every push to `main` and on pull requests (`.github/workflows/ci.yml`).
The gates, in
order, are: **lint → typecheck → knip → madge → build → test**, all on Bun
`1.4.0` with a frozen lockfile.

## License

[MIT](LICENSE)
