# @metro-labs/client

Framework-agnostic TypeScript SDK for the Metro / Stage app logic. It holds the
shared, platform-independent core that both Metro clients use: the Vue web app
(`apps/ui`) and the React Native app (`apps/app`). It is also the package an AI
agent or any headless Node process imports to drive Stage logic without a UI.

Pure TypeScript only. There are no Vue, React, react-native, or expo
dependencies, and no browser-only globals beyond `fetch`. The only runtime
dependency is `viem` (used for typed chain data and the wallet balance reads).
Anything platform-specific (key-value storage, hardware-backed secure storage,
the encrypted XMTP messaging client, the wallet signer, the Railgun
nodejs-mobile bridge) is expressed as an interface and INJECTED by the host at
construction time. See "Dependency-inversion interfaces" below.

## Install / workspace usage

This is a private workspace package (`"private": true`). Inside the Metro
monorepo it resolves via the workspace, so apps just import it by name:

```ts
import { createStageClient, shortAddress } from '@metro-labs/client';
```

The package ships TypeScript source directly (`main`, `module`, and `types` all
point at `./src/index.ts`); consumers compile it as part of their own build, so
there is no separate build step.

### Subpath exports

Everything is available from the root entry, but narrow subpaths are exported so
call sites can keep imports tight:

```
@metro-labs/client                 // everything (barrel)
@metro-labs/client/stage           // createStageClient + interfaces
@metro-labs/client/types
@metro-labs/client/api             // ens / etherscan / opensea / coingecko barrel
@metro-labs/client/api/ens
@metro-labs/client/api/etherscan
@metro-labs/client/api/opensea
@metro-labs/client/api/coingecko
@metro-labs/client/identity/format        // shortAddress, stampAvatarUrl
@metro-labs/client/identity/peerProfiles
@metro-labs/client/profile/snapshot
@metro-labs/client/stamp/resolve
@metro-labs/client/wallet/format
@metro-labs/client/wallet/assets
@metro-labs/client/wallet/balances
@metro-labs/client/accounts/types
@metro-labs/client/accounts/keys
@metro-labs/client/accounts/registry
@metro-labs/client/xmtp/humanize
@metro-labs/client/xmtp/poll
@metro-labs/client/xmtp/sign
@metro-labs/client/xmtp/tx
@metro-labs/client/xmtp/line
@metro-labs/client/xmtp/envelope
@metro-labs/client/xmtp/builders
@metro-labs/client/xmtp/codecs
@metro-labs/client/xmtp/inboxCache
@metro-labs/client/embed/detect
```

## createStageClient

`createStageClient` is the single typed entrypoint. There are no globals and no
hidden singletons: the returned client IS the state holder, so agents and tests
can spin up isolated instances side by side.

```ts
import { createStageClient } from '@metro-labs/client';

const stage = createStageClient({
  env: 'production',
  apiKeys: {
    etherscan: process.env.ETHERSCAN_KEY,
    opensea: process.env.OPENSEA_KEY,
    coingecko: process.env.COINGECKO_KEY,
  },
});
```

### Options

`createStageClient(options: StageClientOptions = {})` accepts:

- `env?: 'production' | 'dev' | 'local'` - network environment, mirroring the
  app's XMTP env values. Defaults to `'production'`. Exposed back as
  `client.env`.
- `apiKeys?: StageApiKeys` - per-service API keys: `etherscan`, `opensea`,
  `coingecko`, `walletconnect`. Each is optional; when omitted the relevant API
  helper falls back to the shared read-only default key baked into the package,
  so read paths work with no config.
- `storage?: Storage` - async key-value store for non-sensitive data. Optional
  today (no wired namespace consumes it yet); becomes required as the modules
  that need it land.
- `secureStorage?: SecureStorage` - same shape as `Storage`, but the platform
  promises hardware-backed storage for key material. Optional today.
- `signer?: SignerTransport` - the wallet signer. The SDK builds payloads
  (typed data, personal messages, tx calls); the signer signs them. Optional
  today (no signer-dependent namespace is wired yet).
- `transports?: { messaging?: MessagingTransport; railgun?: RailgunTransport }`
  - the platform transports. `messaging` powers the network-touching parts of
  `client.messages` (inbox-to-eth resolution); the pure messaging helpers work
  without it. `railgun` is reserved for stage 4.

### Shape of the returned client

```ts
interface StageClient {
  readonly env: StageEnv;
  readonly identity: IdentityModule;
  readonly api: ApiModule;
  readonly wallet: WalletModule;
  readonly messages: MessagesModule;
}
```

The shape is additive: later stages add namespaces, never reshape existing ones.

## Dependency-inversion interfaces

`packages/client` has zero react-native / expo imports. The platform-specific
pieces are declared here as interfaces; the host injects implementations. The
RN app (`apps/app`) supplies the React Native versions, the web app supplies
browser ones, and a Node agent supplies its own.

- `Storage` - a tiny async key-value contract:
  `get`, `set`, `delete`, `keys(prefix?)`. RN backs it with AsyncStorage; web
  with localStorage / IndexedDB; Node with fs.
- `SecureStorage` - the same shape as `Storage`, kept as a distinct type so the
  SDK can require the stronger hardware-backed guarantee wherever key material
  is involved (RN secure enclave / Android keystore via expo-secure-store).
- `SignerTransport` - `address()`, `signMessage(msg)`,
  `signTypedData(typedData)`, optional `sendTransaction(tx)`. Signing stays on
  the wallet / native side; the SDK only builds the payloads. Covers local viem
  keys and WalletConnect.
- `MessagingTransport` - owns the encrypted network and the native XMTP client
  (`@xmtp/react-native-sdk` on RN). The SDK owns message SHAPING and never sees
  keys. Today it surfaces `selfInboxId()`, `selfAddress()`, and
  `inboxEthAddresses(inboxIds)` (batch inbox-id to eth-address resolution).
- `RailgunTransport` - the Railgun nodejs-mobile bridge: `call(method,
  payload)` and `ready()`. Reserved for stage 4; not wired yet.

### Injecting implementations

```ts
import { createStageClient, type MessagingTransport } from '@metro-labs/client';

const messaging: MessagingTransport = {
  selfInboxId: async () => nativeXmtp.inboxId,
  selfAddress: async () => nativeXmtp.address,
  inboxEthAddresses: async ids => nativeXmtp.lookupEthAddresses(ids),
};

const stage = createStageClient({
  transports: { messaging },
  apiKeys: { coingecko: COINGECKO_KEY },
});
```

## Modules

### client.identity

ENS / domain to address resolution and display helpers. All pure
stamp.fyi-backed calls, available on every platform.

```ts
await stage.identity.resolveEnsName('vitalik.eth'); // -> '0xd8dA...' | null
await stage.identity.resolveDomain('foo.base.eth', 8453); // best-effort, never throws
await stage.identity.lookupName('0xd8dA...'); // reverse resolve -> name | null
await stage.identity.resolveSearchInputToAddress('vitalik.eth'); // search box helper

stage.identity.isAddressLike('0xabc...'); // type guard
stage.identity.isDomainLike('foo.eth'); // type guard
stage.identity.shortAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); // '0xd8dA…6045'
stage.identity.avatarUrl('0xd8dA...', 48, cacheBust); // stamp.fyi identicon URL
```

`avatarUrl` is backed by `stampAvatarUrl` from `identity/format`, which builds
`https://stamp.fyi/avatar/eth:<addr>?s=<displayPx * 2>` (retina 2x), with an
optional `&cb=<cacheBust>` suffix to force a refetch when an avatar changes.
`shortAddress` and `stampAvatarUrl` are also importable directly:

```ts
import { shortAddress, stampAvatarUrl } from '@metro-labs/client/identity/format';
```

Peer Snapshot profiles (lazy, batched cache keyed by lower-cased address) live
in `identity/peerProfiles` for the channels list, conversation header, and
message bubbles to render display names + avatars.

### client.api

Read-only on-chain + market data. API keys are bound at construction (falling
back to the shared read keys).

```ts
await stage.api.fetchActivity('0xabc...', 1, 25);        // normal-tx activity, one chain
await stage.api.fetchActivityAllChains('0xabc...', 25);  // merged across chains
await stage.api.getNfts('0xabc...', '1');                // NFTs on one chain
await stage.api.getNftsAcrossChains('0xabc...');         // merged across chains
await stage.api.getErc20UsdPrices('ethereum', [usdc]);   // ERC-20 USD prices
await stage.api.getSimplePrices(['ethereum']);           // by CoinGecko coin id
```

The underlying clients (`ens`, `etherscan`, `opensea`, `coingecko`) are pure
HTTP, so they can be imported directly too via `@metro-labs/client/api`.

### client.wallet

Framework-agnostic balance / asset shaping + value formatting. Key storage and
signing stay behind the injected `SecureStorage` / `SignerTransport`; these
methods need neither.

```ts
// The host injects a token-logo resolver (kit's stampTokenUrl on mobile).
const tokenLogo = (chainId, contract, px) => `https://.../${chainId}/${contract}?s=${px}`;
const rows = await stage.wallet.fetchAssetRows('0xabc...', tokenLogo);

stage.wallet.fmtUsd(1234.5);          // '$1,234.50'
stage.wallet.fmtBalance('0.0034');    // tighter/looser precision by magnitude
stage.wallet.splitUsd('$1,234.50');   // { int: '$1,234', dec: '.50' }
```

`wallet/assets` exposes the asset registry (`ASSETS`, `NATIVE_TOKEN_SENTINEL`,
network logos) and `wallet/format` the pure formatters, both importable
directly.

### client.messages

The framework-agnostic XMTP logic: `metro://` line URIs, the decoded-message to
`HistoryEntry` envelope mapper, outbound payload builders, and the cache-first
inbox-to-eth resolver. The native XMTP client stays in the app behind the
injected `MessagingTransport`; this module is the pure orchestration the app
re-uses.

The line / envelope / builder helpers are pure and work even when no transport
is injected. `resolveInboxEth` / `primeInboxEthCache` require the transport
(they hit the network) and throw if none was injected.

```ts
stage.messages.lineOfConv(convId);        // 'metro://xmtp/<convId>'
stage.messages.lineOfDmPeer('0xabc...');  // 'metro://xmtp/user/<address>'
stage.messages.convIdOfLine(line);        // parse convId | null
stage.messages.metroDmPeerOf(text);       // find a DM peer in free text | null
stage.messages.metroConvIdOf(text);       // find a convId in free text | null

stage.messages.envelopeOf(decodedMsg, line); // DecodedMessageView -> HistoryEntry

// Outbound payloads to hand to the native conv.send:
stage.messages.buildReaction(messageId, '👍');
stage.messages.buildVote(pollMessageId, 0);
stage.messages.buildReply(replyToId, 'gm');
stage.messages.buildStaticAttachment('a.png', 'image/png', dataB64);

// Transport-backed (needs transports.messaging):
await stage.messages.resolveInboxEth([inboxId]); // { inboxId: '0x...' }
await stage.messages.primeInboxEthCache(inboxIds);
stage.messages.clearInboxEthCache();             // e.g. on account switch
```

## Using from an AI agent / headless Node

The SDK was designed to run with no UI. An agent constructs the client directly
and calls typed methods. Read-only namespaces (`identity`, `api`, `wallet`)
need only API keys; messaging needs a `MessagingTransport` you provide.

```ts
import { createStageClient } from '@metro-labs/client';

const stage = createStageClient({
  env: 'production',
  apiKeys: { etherscan: process.env.ETHERSCAN_KEY },
});

const addr = await stage.identity.resolveEnsName('vitalik.eth');
if (addr) {
  const activity = await stage.api.fetchActivityAllChains(addr, 10);
  for (const tx of activity) {
    console.log(stage.identity.shortAddress(tx.from), tx.timestamp);
  }
}
```

To drive messaging headlessly, inject a `MessagingTransport` backed by whatever
XMTP client the agent runs (for example the Node `@xmtp/node-sdk`), then use the
pure builders to shape outbound payloads and `envelopeOf` to normalize inbound
messages into `HistoryEntry` records.

## Migration status

The Stage SDK is being extracted from the apps in stages, exposing only logic
the apps actually USE (nothing speculative), and with no governance / proposal
surface wired in.

- Stage 1 - done. `createStageClient` factory + dependency-inversion
  interfaces; `identity` and `api` namespaces wired.
- Stage 2 - done. Identity display glue (`shortAddress`, `stampAvatarUrl`, peer
  profiles), the `wallet` namespace (asset rows + formatters), and the accounts
  pure logic.
- Stage 3 - done. The `messages` namespace: `metro://` line URIs, the envelope
  mapper, outbound payload builders, and the cache-first inbox-to-eth resolver
  behind the `MessagingTransport`.
- Stage 4 - pending. The Railgun nodejs-mobile bridge behind
  `RailgunTransport`, plus the signer-dependent wallet / signing paths.

### Design notes

- Used-only surface: each interface and namespace exposes exactly what the apps
  call. Methods are added one at a time as each module migrates, never as
  speculative API.
- No governance: this package carries no proposal / voting surface; it is the
  shared client logic only.
- No platform deps: zero react-native / expo / Vue / React imports. Platform
  pieces are injected via the transport + storage interfaces, so the same core
  runs on web, mobile, and headless Node.
