# stage

> The universal Stage app: one Expo + React Native codebase for XMTP messaging, profiles, and an onchain wallet on Android, iOS, and the web.

## Overview

`stage` is the universal Stage app, built with Expo and React Native, serving Android, iOS, and the web (via react-native-web) from one codebase. It is an XMTP messenger with multi-account support, Snapshot profiles, group channels, search, and an onchain wallet (assets, balances, and Railgun shielded transfers; the web wallet is public-only by design). Per-platform code lives solely in Metro platform extensions (`x.ts` native / `x.web.ts` web) under `platform/` and `lib/`.

All platform-neutral logic comes from [`@stage-labs/client`](../../packages/client) and the visual language from [`@stage-labs/kit`](../../packages/kit). Screens are direct kit JSX fed by pure models from `views/` (`@views`); the kit's JSON `ViewHost` renderer is used only for runtime-dynamic chat/agent message widgets. The Railgun engine runs on-device through a `nodejs-mobile` bridge (mobile only).

## Stack

- Expo (managed workflow) with `expo-dev-client` and `expo-router` for file-based navigation
- React Native + Reanimated; no NativeWind, no global state library
- XMTP via `@xmtp/react-native-sdk`; wallets via `wagmi` + `viem` + `@reown/appkit`
- `expo-secure-store` for keys and tokens (Keychain / Keystore on native)

## Setup

```sh
bun install                 # from the repo root, installs apps/stage too
```

## Usage

```sh
bun --cwd apps/stage start    # launch the Expo bundler
bun --cwd apps/stage android  # build + run on Android
bun --cwd apps/stage ios      # build + run on iOS
bun --cwd apps/stage web      # run in the browser
bun --cwd apps/stage run build:web  # static web export (Netlify publishes dist/)
```

> Note: Expo's RN bundler is itself called Metro, a naming collision with the Metro chat/orchestrator product. The bundler here is `bun --cwd apps/stage start`. New native modules require a fresh dev-client / APK build, not just a JS reload.

## Project structure

```
app/          # expo-router routes (tabs, group, user, wallet, settings, xmtp, accounts)
components/   # screen + UI components in kit JSX (chrome/, settings/, wallet/, ...)
views/        # pure screen models + chat-widget builders, imported as @views
platform/     # per-platform seams (x.ts native / x.web.ts web overrides)
lib/          # accounts, caches, XMTP glue (incl. xmtp.*.web adapters), wallet helpers
modules/      # local Expo native modules (metro-pill)
plugins/      # config plugins
scripts/      # build helpers (e.g. nodejs-mobile project install)
assets/       # fonts + images
app.config.js # Expo app config
eas.json      # EAS build profiles
```

## Scripts

| Script              | Description                                        |
| ------------------- | ------------------------------------------------- |
| `bun run start`     | Start the Expo bundler.                           |
| `bun run android`   | Build and run on Android.                          |
| `bun run ios`       | Build and run on iOS.                              |
| `bun run web`       | Run in the browser.                               |
| `bun run typecheck` | Type-check with `tsc --noEmit`.                   |
| `bun run lint`      | Lint `app/`, `components/`, and `lib/`.            |

## Links

- Shared logic: [`@stage-labs/client`](../../packages/client)
- Design tokens: [`@stage-labs/kit`](../../packages/kit)
