# app

> Stage for mobile: an Expo + React Native client for XMTP messaging, profiles, and an onchain wallet.

## Overview

`app` is the Stage mobile client, built with Expo and React Native. It is an XMTP messenger with multi-account support, Snapshot profiles, group channels, search, and an onchain wallet (assets, balances, and Railgun shielded transfers). It is the mobile counterpart to the Vue web client in [`apps/ui`](../ui).

All platform-neutral logic comes from [`@stage-labs/client`](../../packages/client) and the visual language from [`@stage-labs/kit`](../../packages/kit), so behaviour and design stay in step with the web app. The Railgun engine runs on-device through a `nodejs-mobile` bridge.

## Stack

- Expo (managed workflow) with `expo-dev-client` and `expo-router` for file-based navigation
- React Native + Reanimated; no NativeWind, no global state library
- XMTP via `@xmtp/react-native-sdk`; wallets via `wagmi` + `viem` + `@reown/appkit`
- `expo-secure-store` for keys and tokens (Keychain / Keystore on native)

## Setup

```sh
bun install                 # from the repo root, installs apps/app too
```

## Usage

```sh
bun --cwd apps/app start    # launch the Expo bundler
bun --cwd apps/app android  # build + run on Android
bun --cwd apps/app ios      # build + run on iOS
bun --cwd apps/app web      # run in the browser (limited)
```

> Note: Expo's RN bundler is itself called Metro, a naming collision with the Metro chat/orchestrator product. The bundler here is `bun --cwd apps/app start`. New native modules require a fresh dev-client / APK build, not just a JS reload.

## Project structure

```
app/          # expo-router routes (tabs, group, user, wallet, settings, xmtp, accounts)
components/   # screen + UI components (channel cards, composer, account manager, ...)
lib/          # accounts, caches, XMTP glue, wallet helpers, theme overrides
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
- Web counterpart: [`apps/ui`](../ui)
