# stage

> The universal Stage app: one Expo + React Native codebase for encrypted XMTP messaging, onchain names and a smart-account wallet on Android, iOS, web and desktop.

## Overview

`stage` serves Android, iOS, the web (via react-native-web) and the Electron desktop shell from one codebase. It is an XMTP messenger with multi-account support, group channels, message requests shown inline in the channel list (only rejected conversations are hidden), free `*.stage.base.eth` names and avatars, search, and a ZeroDev smart-account wallet on Base (assets, balances, transfers, recovery phrase backup). Per-platform code lives solely in Metro platform extensions (`x.ts` native / `x.web.ts` web, and `x.ios.ts` for the few iOS-only seams) under `platform/`, `lib/` and `components/`; a small `Platform.OS === 'web'` gate is fine for trivial divergences.

All platform-neutral logic comes from [`@stage-labs/client`](../../packages/client) and the visual language from [`@stage-labs/kit`](../../packages/kit). Screens and chat message content are direct kit JSX fed by pure `.model.ts` files colocated with their components.

## Stack

- Expo (managed workflow) with `expo-dev-client` and `expo-router` for file-based navigation
- React Native (new architecture) + Reanimated; hand-rolled stores + react-query, no global state library
- XMTP via `@xmtp/react-native-sdk` natively and `@xmtp/browser-sdk` on web, behind the `lib/xmtp.*` seams
- Wallet via `viem` + `@zerodev/sdk` (Kernel smart accounts, ECDSA owner validator, sponsored userOps)
- `expo-secure-store` for keys (Keychain / Keystore on native, device-bound), IndexedDB/OPFS on web

## Setup

```sh
bun install                 # from the repo root, installs apps/stage too
```

## Usage

```sh
bun --cwd apps/stage start          # launch the Expo bundler
bun --cwd apps/stage android        # build + run on Android
bun --cwd apps/stage ios            # build + run on iOS
bun --cwd apps/stage web            # run in the browser
bun --cwd apps/stage run build:web  # web export (Netlify publishes dist/)
bun run --cwd apps/stage/desktop start  # Electron shell around the web export
```

> "Metro" in this repo always means Expo's JavaScript bundler, never the product. New native modules require a fresh dev-client / APK build, not just a JS reload.

Linting is centralised at the repo root (`bun run lint`).

## Links

- Shared logic: [`@stage-labs/client`](../../packages/client)
- Design system: [`@stage-labs/kit`](../../packages/kit)
- Releases: [`docs/mobile-release.md`](../../docs/mobile-release.md), [`docs/desktop-release.md`](../../docs/desktop-release.md)
