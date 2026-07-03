# Stage

Stage is an XMTP messenger with multi-account support, Snapshot profiles, group
channels, and an onchain wallet (assets, balances, and Railgun shielded
transfers). It ships as **one universal Expo app** serving Android, iOS, and the
web from the same React Native codebase (web via react-native-web), backed by a
framework-agnostic TypeScript core, a design-system kit with a JSON widget
renderer, and a Cloudflare Worker that resolves link previews.

## Monorepo layout

```
apps/
  stage/    # stage — the universal Expo + React Native app (android · ios · web)
            #   views/     widget builders + screen models (imported as @views)
            #   platform/  per-platform seams (.ts native / .web.ts overrides)
            #   lib/       state + SDK orchestration (incl. xmtp.*.web adapters)
  proxy/    # proxy — Cloudflare Worker for link-preview / image / x402 proxying
packages/
  client/   # @stage-labs/client — framework-agnostic shared logic (XMTP cores,
            #   Snapshot profiles, embeds, wallet, account keys, Railgun, APIs)
  kit/      # @stage-labs/kit — design system: tokens, icons, theme contracts,
            #   React Native primitives + the JSON KitRenderer/ViewHost
  config/   # @stage-labs/config — shared ESLint/TS/knip/madge presets + stage CLI
```

Each workspace has its own README with details.

## Prerequisites

- [Bun](https://bun.sh) `1.3.9` (pinned via the `packageManager` field)
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
bun --cwd apps/stage start      # Expo bundler (Metro)
bun --cwd apps/stage android    # build + run on Android
bun --cwd apps/stage ios        # build + run on iOS
bun --cwd apps/stage web        # run the app in a browser
bun --cwd apps/stage run build:web  # static web export (Netlify publishes dist/)
bun --cwd apps/proxy dev        # Cloudflare Worker (wrangler dev)
```

## CI / quality gates

CI runs on every push to `main` and on pull requests (`.github/workflows/ci.yml`),
delegating to the reusable `.github/workflows/_ci.yml` workflow. The gates, in
order, are: **lint → typecheck → knip → madge → build → test**, all on Bun
`1.3.9` with a frozen lockfile.

## License

[MIT](LICENSE)
