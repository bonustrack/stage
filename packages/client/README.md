# @stage-labs/client

> Framework- and runtime-agnostic TypeScript core behind the universal Stage app.

## Overview

`@stage-labs/client` holds the framework-independent logic behind the universal Stage app ([`apps/stage`](../../apps/stage)). It is pure TypeScript with no React or react-native imports, so the same code runs in a browser, in Hermes, and in Node.

It covers the XMTP orchestration cores (content codecs, humanisation, message builders, channel filtering/caching, consent, groups, envelopes), onchain identity (Basenames and `*.stage.base.eth` names, peer profiles, avatar URLs), the smart-account layer (accounts, keys, ZeroDev validator plans, passkey linking, recovery), wallet formatting/balances/tx decoding, read-only API clients (ENS, Etherscan, OpenSea, CoinGecko, GitHub link detection), x402 challenges, and the shared types that tie it all together. Boundary data is validated with zod (`validate.ts`); XMTP content is always decoded through a schema.

## Install

The package is consumed inside the monorepo via `workspace:*`; no separate install is needed.

```sh
bun install            # from the repo root
```

```jsonc
// in a consuming workspace's package.json
"dependencies": { "@stage-labs/client": "workspace:*" }
```

The exports point at `.ts` source, so consumers bundle the TypeScript directly (Metro/Expo for every platform). There is no build step.

## Usage

Import from the granular subpath exports so bundlers tree-shake what you do not use:

```ts
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { detectEmbed } from '@stage-labs/client/embed/detect';
import type { HistoryEntry } from '@stage-labs/client/types';
```

There is no root barrel: every module is imported through its own subpath export.

## Project structure

```
src/
  xmtp/        # codecs, humanize, builders, line routing, channelsFilter/channelsCache, summarizeRow,
               # consent, groups, envelope, clientErrors, polls, signatures, tx requests, read state, push server
  identity/    # Basenames + stage names (read/write), onchain profiles, peer profile lookups, formatting
  profile/     # avatar URL helper (stamp + IPFS gateway) and picture upload parsing
  accounts/    # account records, key storage constants, HD index, device transfer
  zerodev/     # Kernel smart accounts: derive, validator plan, device passkeys, root-key migration, passkey link, recovery key access
  wallet/      # formatting, assets, balances, prices, send, tx decode/simulate/error
  api/         # read-only clients: ens, etherscan, opensea, coingecko, github link detection
  routing/     # deep links and handle parsing
  embed/       # link/embed detection
  image/       # EXIF/metadata stripping before upload
  text/        # markdown helpers
  x402/        # x402 payment challenge parsing
  validate.ts  # parseOrThrow / parseOrNull zod boundary helpers
  types.ts     # shared domain types
```

## Kernel key model

Smart accounts are ZeroDev Kernel v3.1 on Base (EntryPoint 0.7).

- The recovery-phrase ECDSA validator is always the root (sudo) validator. New accounts never swap the root to a passkey.
- A passkey is per device: a Kernel permission validation (WebAuthnSigner 0.0.4 `0x65DEeC8fEe717dc044D0CFD63cCf55F02cCaC2b3` + sudo policy `0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7`, execute selector) installed in enable mode. The root ECDSA key on the same device signs the enable data and the new passkey signs the user operation (`zerodev/devicePasskey`), so any device holding the phrase adds its own passkey in one step.
- `planKernelSigning` (`zerodev/validatorPlan`): message signing always uses ECDSA; transactions use this device's passkey when it is installed, otherwise the ECDSA root; an undeployed account always signs as the ECDSA root.
- Legacy accounts whose root is still a passkey validator migrate with `rootKeyMigrationCalls` (`zerodev/rootKey`): one `execute` batch of two self-calls, `changeRootValidator(ECDSA)` then `uninstallValidation(old passkey validator)`. The batch can be signed by the root passkey, a device passkey, or the ECDSA secondary validator when it may call `execute` ("Recovery key can transact"). Self-calls pass Kernel's `onlyEntryPointOrSelfOrRoot`; a single self-call would be sent as raw calldata instead of through `execute`, which a secondary validator may not do. `planRootKeyMigration` picks the path.

## Scripts

| Script              | Description                  |
| ------------------- | --------------------------- |
| `bun run typecheck` | Type-check without emitting. |
| `bun run test`      | Run the unit tests.          |

Linting is centralised at the repo root (`bun run lint`).

## Links

- Consumed by [`apps/stage`](../../apps/stage)
- Design system: [`@stage-labs/kit`](../kit)
