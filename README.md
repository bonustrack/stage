# Stage

Stage is a private, encrypted messenger built on XMTP, with group channels,
multi-account support, free onchain names and avatars (`*.stage.base.eth` on
Base), and a smart-account wallet (assets, balances, transfers, passkeys,
recovery phrase backup). It ships as **one universal Expo app** serving Android, iOS,
web and desktop from the same React Native codebase (web via
react-native-web), backed by a framework-agnostic TypeScript core, a
design-system kit, a Cloudflare Worker and a push-notification server.

## Monorepo layout

```
apps/
  stage/      # stage — the universal Expo + React Native app (android · ios · web · desktop)
              #   app/         expo-router file routes (routes only — helpers live in components/)
              #   components/  kit-JSX screens + colocated *.model.ts pure models, one folder per family
              #   lib/         state + SDK orchestration (incl. the xmtp.*.web adapters and *.core.ts)
              #   modules/     messaging facade (modules/messaging) + the stage-pill native module
              #   platform/    storage seams (.ts native / .web.ts overrides)
              #   test/        pure-model tests (bun test)
              #   desktop/     Electron shell that bundles the web export (nested workspace)
  proxy/      # Cloudflare Worker: link previews, image resize, x402, XMTP history/push relays,
              #   the *.stage.base.eth names service, and the bundler.stage.box manifest proxy
  push/       # XMTP notification server (upstream image, deployed to Fly as stage-push)
packages/
  client/     # @stage-labs/client — framework-agnostic shared logic (XMTP cores + codecs,
              #   identity/names, wallet, accounts + zerodev, read-only APIs, x402)
  kit/        # @stage-labs/kit — design system: tokens, icons, theme contracts,
              #   and one React Native component family (renders on web via RNW)
  config/     # @stage-labs/config — shared ESLint/TS/knip/madge presets + the stage CLI
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
bun run typecheck   # turbo run typecheck
bun run lint        # stage lint (eslint over the whole repo)
bun run lint:fix    # stage lint --fix
bun run check       # lint + typecheck
bun run knip        # unused files / deps / exports
bun run madge       # circular-dependency check
```

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
| `EXPO_PUBLIC_ZERODEV_RP_ID` | Passkey relying-party id (default `stage.box`) |
| `EXPO_PUBLIC_SWARMY_KEY` | Swarmy (`api.swarmy.cloud`) bearer key for encrypted attachment upload |
| `EXPO_PUBLIC_LINKPROXY_URL` | Base URL of the proxy Worker (default `https://proxy.stage.box`) |
| `EXPO_PUBLIC_PUSH_SERVER_URL` | Push server base URL |
| `EXPO_PUBLIC_ETHERSCAN_API_KEY` / `EXPO_PUBLIC_OPENSEA_API_KEY` | Read-only API keys for wallet activity and NFTs |

Attachments (already client-side encrypted) upload directly to Swarmy's
`POST /api/files`; the encrypted blob is read back from the keyless gateway
(`api.swarmy.cloud/bzz/<ref>/`). Because `EXPO_PUBLIC_*` values are inlined
into the shipped bundle, `EXPO_PUBLIC_SWARMY_KEY` is client-visible — scope,
rate-limit and rotate it.

## Releases

- **Web:** Netlify builds `bun run build:web` from `apps/stage` on every push to `main`.
- **Mobile:** bumping `version` in `apps/stage/app.config.js` triggers
  `release-mobile.yml` (EAS Build + Submit to Play and TestFlight); every push
  publishes a JS-OTA dev-client preview. See `docs/mobile-release.md`.
- **Desktop:** the same version bump runs `release-desktop.yml`, which builds the
  macOS / Windows / Linux installers and publishes them to the GitHub Release
  that the landing page links to. See `docs/desktop-release.md`.
- **Proxy / push:** the proxy Worker deploys through Cloudflare Workers Builds on push to `main` (typecheck and tests run first); `deploy-push-server.yml` deploys the push server.

## CI / quality gates

CI runs on every push to `main` and on pull requests (`.github/workflows/ci.yml`),
delegating to the reusable `.github/workflows/_ci.yml` workflow. The gates, in
order, are: **lint → typecheck → knip → madge → build → test**, all on Bun
`1.4.0` with a frozen lockfile.

## License

[MIT](LICENSE)
