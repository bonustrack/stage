# @stage-labs/client

> Framework-agnostic TypeScript core shared by the Metro web and mobile clients.

[![lines of code](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.codetabs.com%2Fv1%2Floc%2F%3Fgithub%3Dbonustrack%2Fstage&query=%24%5B%3F(%40.language%3D%3D%27Total%27)%5D.linesOfCode&label=lines%20of%20code&color=blue)](https://github.com/bonustrack/stage)

## Overview

`@stage-labs/client` holds the platform-independent logic both Metro clients share: the Vue web app ([`apps/ui`](../../apps/ui)) and the React Native app ([`apps/app`](../../apps/app)). It is pure TypeScript with no Vue, React, or react-native imports, so the same code runs in a browser, in Hermes, and in Node.

It covers Snapshot profile resolution, XMTP content humanisation and message builders, embed detection, Stamp avatar resolution, wallet formatting and balances, account key derivation, the Railgun wire protocol, read-only API clients (ENS, Etherscan, OpenSea, CoinGecko), and the shared types that tie it all together.

## Install

The package is consumed inside the monorepo via `workspace:*`; no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@stage-labs/client": "workspace:*" }
```

The exports point at `.ts` source, so consumers bundle the TypeScript directly (Vite for web, Metro/Expo for mobile). There is no build step.

## Usage

Import from the granular subpath exports so bundlers tree-shake what you do not use:

```ts
import { humanize } from '@stage-labs/client/xmtp/humanize';
import { resolveStamp } from '@stage-labs/client/stamp/resolve';
import { detectEmbed } from '@stage-labs/client/embed/detect';
import type { Message } from '@stage-labs/client/types';
```

The package root (`@stage-labs/client`) re-exports everything.

## Project structure

```
src/
  xmtp/        # humanize, message builders, codecs, line parsing, inbox cache
  profile/     # Snapshot profile resolution
  identity/    # address/name formatting, peer profile lookups
  wallet/      # formatting, token assets, balances
  accounts/    # account key derivation + registry
  api/         # read-only clients: ens, etherscan, opensea, coingecko
  embed/       # link/embed detection
  stamp/       # stamp.fyi avatar resolution
  railgun/     # Railgun wire protocol (shield/unshield/transfer calls)
  stage/       # Stage SDK client + interfaces
  types.ts     # shared domain types
  index.ts     # root barrel
```

## Scripts

| Script              | Description                  |
| ------------------- | --------------------------- |
| `bun run typecheck` | Type-check without emitting. |
| `bun run lint`      | Lint `src/`.                |

## Links

- Consumed by [`apps/ui`](../../apps/ui) and [`apps/app`](../../apps/app)
- Design tokens live in [`@metro-labs/kit`](../kit)
