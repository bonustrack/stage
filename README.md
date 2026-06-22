# Stage

Stage is an XMTP messenger with multi-account support, Snapshot profiles, group
channels, and an onchain wallet (assets, balances, and Railgun shielded
transfers). It ships as two clients that stay visually and functionally
parallel — a Vue 3 web app and an Expo / React Native mobile app — backed by a
shared framework-agnostic TypeScript core, a shared design-system kit, and a
Cloudflare Worker that resolves link previews.

## Monorepo layout

```
packages/
  client/   # @stage-labs/client — framework-agnostic shared logic (XMTP, Snapshot
            #   profiles, embeds, wallet/balances, account keys, Railgun, API clients)
  kit/      # @stage-labs/kit — shared design system: tokens, icon data, theme
            #   contracts + a few React Native primitive components
  config/   # @stage-labs/config — shared ESLint and TypeScript config presets
apps/
  app/      # app — Expo + React Native mobile client (XMTP messenger + wallet)
  ui/       # ui — Vue 3 + Vite web client (channels, conversations, profiles)
  proxy/    # proxy — Cloudflare Worker for link-preview / image / x402 proxying
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
bun run lint        # eslint .
bun run lint:fix    # eslint . --fix
bun run check       # lint + typecheck
bun run knip        # unused files / deps / exports
bun run madge       # circular-dependency check
```

Tasks are orchestrated by [Turbo](https://turbo.build); see `turbo.json` for the
pipeline (`build`, `test`, `typecheck`).

Per-app dev servers:

```sh
bun --cwd apps/ui dev       # Vue web dev server (Vite)
bun --cwd apps/app start    # Expo bundler for the mobile app
bun --cwd apps/proxy dev    # Cloudflare Worker (wrangler dev)
```

## CI / quality gates

CI runs on every push to `main` and on pull requests (`.github/workflows/ci.yml`),
delegating to the reusable `.github/workflows/_ci.yml` workflow. The gates, in
order, are: **lint → typecheck → knip → madge → build → test**, all on Bun
`1.3.9` with a frozen lockfile.

## License

[MIT](LICENSE)
