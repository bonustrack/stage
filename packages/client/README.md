# @metro-labs/client

Framework-agnostic shared logic for the Metro clients (`apps/ui` Vue web +
`apps/app` React Native). **Pure TypeScript** — no Vue, no React, no
react-native, no browser-only globals beyond `fetch`.

This was previously the loose `apps/_shared/*` directory, imported via relative
paths (`../../_shared/...`) on mobile and a `@shared` Vite/tsconfig alias on
web. It's now a real workspace package so both apps import it the same way.

## Modules

| Subpath | What |
| --- | --- |
| `@metro-labs/client/types` | `HistoryEntry` — the message/event envelope both feeds render |
| `@metro-labs/client/profile/snapshot` | Snapshot hub endpoints, EIP-712 schema, profile read/write, `avatarRenderUrl`, `getCacheHash`, `PROFILE_FIELD_LIMITS` |
| `@metro-labs/client/xmtp/humanize` | `previewOfXmtpContent`, `humanizeGroupUpdated`, `shortContentType` |
| `@metro-labs/client/embed/detect` | `youtubeIdOf`, `mapCoordsOf`, `osmTileXY`, `osmTileUrl` |
| `@metro-labs/client/stamp/resolve` | `resolveDomain`, `lookupName`, `isAddressLike`, `isDomainLike`, `resolveSearchInputToAddress` |
| `@metro-labs/client/api` | Pure HTTP clients: `resolveEnsName`, Etherscan activity (`fetchActivity`, `fetchActivityAllChains`), OpenSea NFTs (`getNfts`, `getNftsAcrossChains`), CoinGecko prices (`getErc20UsdPrices`, `getSimplePrices`). Also at `./api/ens`, `./api/etherscan`, `./api/opensea`, `./api/coingecko`. |
| `@metro-labs/client/stage` | The Stage SDK: `createStageClient(...)` factory + dependency-inversion interfaces (`Storage`, `SecureStorage`, `SignerTransport`, `MessagingTransport`, `RailgunTransport`). |

The package root (`@metro-labs/client`) re-exports everything.

## Stage SDK (`createStageClient`)

A single typed entrypoint that takes injected platform deps and returns a
framework-agnostic client. No globals, no hidden singletons; the client holds
its own state so AI agents and tests can spin up isolated instances.

```ts
import { createStageClient } from '@metro-labs/client/stage';

const stage = createStageClient({
  env: 'production',
  apiKeys: { etherscan, opensea, coingecko },
  // Later stages: storage, secureStorage, signer, transports.messaging,
  // transports.railgun (RN implementations injected by apps/app).
});

await stage.identity.resolveEnsName('vitalik.eth');
await stage.api.fetchActivityAllChains(address);
await stage.api.getNftsAcrossChains(address);
await stage.api.getSimplePrices(['ethereum']);
```

The factory is **Stage**-named (not Metro). Platform-specific code
(expo-secure-store, the `@xmtp/react-native-sdk` transport, the Railgun
nodejs-mobile bridge) lives in `apps/app` and is injected through the
interfaces above; `packages/client` stays free of any react-native / expo
import. Stage 1 wires only the `identity` + `api` namespaces (no transport
needed); messaging, wallet/accounts, and Railgun land in later stages.

## No build step

Exports point at `.ts` source — both consumers bundle TypeScript directly
(Vite for web, Metro/Expo for mobile).
