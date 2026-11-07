# @stage-labs/client

> Framework- and runtime-agnostic TypeScript core behind the universal Stage app.

## Overview

`@stage-labs/client` holds the framework-independent logic behind the universal Stage app ([`apps/stage`](../../apps/stage)). It is pure TypeScript with no React or react-native imports, so the same code runs in a browser, in Hermes, and in Node.

The rule for what lives here: logic that needs no React, React Native, Expo or XMTP SDK value import, no env read and no storage. Hooks, SDK calls, env and storage stay in the app, which imports the logic from here.

It covers the XMTP orchestration cores (the content type table with one descriptor per content type, the canonical message shape and its envelope, what each context shows, humanisation, message builders, channel filtering/caching, groups), onchain identity (Basenames and `*.stage.base.eth` names, peer profiles, avatar URLs), the smart-account layer (accounts, keys, ZeroDev ECDSA accounts, recovery), wallet formatting/balances/tx decoding, simulation and confirm summaries, message body, link card and code block parsing, read-only API clients (ENS, DefiLlama prices, GitHub link detection), x402 challenges and payments, and the shared types that tie it all together. Boundary data is validated with zod (`validate.ts`); XMTP content is always decoded through a schema.

## Install

The package is consumed inside the monorepo via `workspace:*`; no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@stage-labs/client": "workspace:*" }
```

The exports point at `.ts` source, so consumers bundle the TypeScript directly (Metro for the app, wrangler for the Workers, esbuild for the desktop main process). There is no build step.

## Usage

Import from the granular subpath exports so bundlers tree-shake what you do not use:

```ts
import { PROXY_ROUTES } from '@stage-labs/client/endpoints';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { youtubeIdOf } from '@stage-labs/client/embed/detect';
import type { HistoryEntry } from '@stage-labs/client/types';
```

There is no root barrel: every module is imported through its own subpath export.

`@stage-labs/client/xmtp/sendFetch` has one runtime importer that neither the TypeScript graph nor knip sees: the `@xmtp/browser-sdk` patch (`patches/@xmtp%2Fbrowser-sdk@7.0.0.patch`) imports it into the SDK bundle. Renaming or moving that subpath breaks web messaging, so change the patch with it.

## Project structure

The public API is the `exports` map in [`package.json`](./package.json): one subpath per module, grouped under `src/` by domain (`xmtp/`, `identity/`, `wallet/`, `mail/`, `nodes/`, `net/`, ...).

## Kernel key model

Smart accounts are ZeroDev Kernel v3.1 on Base (EntryPoint 0.7).

- The recovery-phrase ECDSA validator is the root (sudo) and sole wallet validator.
- Messages, typed data and transactions use the same ECDSA owner key for deployed and undeployed accounts.
- `createEcdsaKernel` keeps the owner, HD index, Kernel version and existing address when reconstructing a wallet. Restoring a phrase preserves its wallet identity.

## Scripts

| Script         | Description                  |
| -------------- | ---------------------------- |
| `bun check`    | Type-check without emitting. |
| `bun run test` | Run the unit tests.          |

Linting is centralised at the repo root (`bun run lint`).

## Links

- Consumed by [`apps/stage`](../../apps/stage), the desktop shell [`apps/stage/desktop`](../../apps/stage/desktop), the Workers [`apps/proxy`](../../apps/proxy) and [`apps/dispatch`](../../apps/dispatch), and the `@xmtp/browser-sdk` patch (see Usage)
- Design system: [`@stage-labs/kit`](../kit)
