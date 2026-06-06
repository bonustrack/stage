# Proposal: framework-agnostic Metro client SDK

Status: DRAFT for design sign-off (do not implement yet)
Issue: https://github.com/bonustrack/metro/issues/267
Author: Tony (for Less), 2026-06-06

## 1. Goal

Move as much app logic as possible out of `apps/app` into `packages/client`,
turned into a clean, framework-agnostic TypeScript SDK with ZERO react-native
dependencies. The SDK should be ergonomic for human devs AND AI agents: one
typed surface, discoverable namespaces, minimal hidden state, good docstrings.

`apps/app` keeps only what is genuinely platform-specific (UI, navigation,
storage, expo/native modules, native transports) and consumes the SDK.

This document is the PROPOSAL: the survey, the design, and a staged migration
plan. No big-bang refactor happens until Less approves the design.

## 2. Current state

### 2.1 What `packages/client` is today

`@metro-labs/client` already exists as a pure-TS package (no Vue, no React, no
react-native). It is shared between the Vue web client (`apps/ui`) and the RN
app (`apps/app`). Current exports:

- `types` (HistoryEntry envelope shape, shared with the daemon)
- `profile/snapshot` (Snapshot profile constants, EIP-712 types, GraphQL queries, avatar/cache helpers)
- `xmtp/humanize` (content-type previews, mention stripping, group-updated text)
- `xmtp/poll`, `xmtp/sign`, `xmtp/tx` (custom Metro content-type wire shapes + plain-text fallbacks)
- `embed/detect` (link/embed detection)
- `stamp/resolve` (stamp.fyi avatar URLs)

So the package is already the right home; it just holds a thin slice. It is
mostly data shapes and pure functions, with no client object, no factory, no
stateful API.

### 2.2 What lives in `apps/app/lib` and should move

`apps/app/lib` holds ~90 modules. The framework-agnostic logic that SHOULD move:

- XMTP protocol logic and data shaping: `xmtp.envelope.ts` (decoded message
  to HistoryEntry), `xmtp.types.ts` (line/conv id helpers, shortAddress),
  `xmtp.identity.ts` (inbox to eth resolution + member helpers), `xmtp.labels.ts`
  + `xmtp.labels.suggest.ts`, `xmtp.github.ts`, `xmtp.feed.ts` ordering/merge
  logic (the data side, not the React hook), `xmtp.groups.ts` / `xmtp.conv.ts`
  / `xmtp.messages.ts` orchestration (the parts that are not direct SDK calls).
- Custom content codecs as PURE wire codecs: `xmtpPollCodec.ts`,
  `xmtpSignatureCodec.ts`, `xmtpTxCodec.ts` (encode/decode logic; the RN SDK
  registration wrapper stays in the app).
- Wallet + signing orchestration: `wallet.ts`, `wcSigner.ts` signing flow,
  `accounts.ts` / `accounts.keys.ts` / `accounts.types.ts` registry logic (the
  registry rules, not the secure-store I/O), `accountEpoch.ts`.
- API clients (already pure HTTP + viem): `ens.ts`, `etherscan.ts`,
  `opensea.ts`, `coingecko.ts`, `githubDetect.ts`, `embedDetect.ts`,
  `mdParser.ts`, `peerProfiles.ts`, `tx.ts`.
- Governance: the Snapshot profile/proposal logic (already partly in the
  package) plus the app-side glue.
- Railgun: the entire protocol/SDK layer under `lib/railgun/*` EXCEPT the
  nodejs-mobile bridge transport. `sdkApi.ts`, `sdkTx.ts`, `sdkWallet.ts`,
  `sdkGas.ts`, `shield.ts`, `unshield.ts`, `send.ts`, `tokens.ts`,
  `networks.ts`, `deriveKeys.ts`, `explorer.ts`, balance/scan logic, and the
  `bridge/*` wire protocol (`protocol.ts`, `wire.ts`, `handshake.ts`,
  `*Calls.ts`) are framework-agnostic message-shaping; only `bridge/nodejsMobile.ts`
  and `native.ts`/`sdkEngine.ts` are RN.

### 2.3 What MUST stay in `apps/app` (RN / platform-specific)

- All UI, navigation, screens, components.
- The XMTP transport: `@xmtp/react-native-sdk` (native MLS/SQLCipher client).
  Key material never crosses the JS bridge, so the SDK cannot own the client;
  it can only own everything around it.
- Storage: `expo-secure-store`, AsyncStorage, the local sqlite paths
  (`xmtp.dbkey.ts`, `cache.ts`, all `*.ts` that import expo-secure-store).
- Native + expo modules: push (`push.device.ts`, `pushRegister*.ts`),
  `theme.ts`, `toast.ts`, `deepLinks.ts`, `walletconnect.ts` connector,
  `scrollPos`/`drafts`/`pins`/`archived`/`lastRoute` (UI persistence).
- The Railgun nodejs-mobile bridge transport (`railgun/bridge/nodejsMobile.ts`,
  `native.ts`, `sdkEngine.ts` boot).
- All React hooks (`use*.ts`) - they are framework glue. Their data logic moves
  to the SDK; the hooks become thin wrappers that call SDK methods.

The split rule: protocol/data/shaping/orchestration moves; transport + storage +
UI + native stay, and are handed to the SDK as INJECTED interfaces.

## 3. Design principle: dependency inversion

The SDK must not import react-native, expo, or `@xmtp/react-native-sdk`. The two
genuinely platform-specific dependencies (storage and the native transports) are
defined by the SDK as INTERFACES; `apps/app` supplies the RN implementations at
construction time. The web client supplies browser implementations. The daemon
or an AI agent supplies Node implementations.

```ts
// Storage: a tiny async key-value contract. RN backs it with expo-secure-store
// + AsyncStorage; web with localStorage/IndexedDB; Node with fs.
export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

// SecureStorage: same shape, but the platform promises hardware-backed storage
// for key material. RN -> secure enclave / Android keystore.
export interface SecureStorage extends Storage {}

// MessagingTransport: the SDK owns conversation/message SHAPING; the transport
// owns the encrypted network + the native client. The SDK never sees keys.
export interface MessagingTransport {
  selfInboxId(): Promise<string>;
  selfAddress(): Promise<string>;
  listConversations(): Promise<RawConversation[]>;
  getConversation(id: string): Promise<RawConversation | null>;
  sendEncoded(convId: string, content: EncodedContent): Promise<{ messageId: string }>;
  streamAll(onMessage: (m: RawMessage) => void): Promise<Unsubscribe>;
  createGroup(memberAddresses: string[], opts?: GroupOpts): Promise<RawConversation>;
  addMembers(convId: string, addresses: string[]): Promise<void>;
  // ...consent, history pagination, attachment upload hooks
}

// SignerTransport: signing happens in the wallet/native side. The SDK builds
// the payloads (EIP-712 typed data, personal messages, tx calls) and hands them
// to the transport to sign. Covers local viem keys AND WalletConnect.
export interface SignerTransport {
  address(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTypedData(typedData: Eip712TypedData): Promise<string>;
  sendTransaction?(tx: TxRequest): Promise<{ hash: string }>;
}

// RailgunTransport: the nodejs-mobile bridge. SDK builds the request frames
// (already pure in bridge/protocol.ts + wire.ts); transport ships them over the
// platform bridge and returns responses.
export interface RailgunTransport {
  call<TReq, TRes>(method: string, payload: TReq): Promise<TRes>;
  ready(): Promise<void>;
}
```

`apps/app` already has all of these implementations in fragments today; the
migration is to wrap the existing RN code behind these interfaces rather than
rewrite it.

## 4. Proposed SOTA API

### 4.1 Top-level factory

A single entrypoint that takes the injected platform deps and returns a fully
typed client. No globals, no hidden singletons - the client IS the state holder,
so AI agents and tests can spin up isolated instances.

```ts
import { createMetroClient } from '@metro-labs/client';

const metro = createMetroClient({
  signer,                  // SignerTransport
  storage,                 // Storage
  secureStorage,           // SecureStorage
  transports: {
    messaging,             // MessagingTransport (RN: @xmtp/react-native-sdk)
    railgun,               // RailgunTransport (RN: nodejs-mobile) - optional
  },
  env: 'production',       // 'production' | 'dev' | 'local'
  apiKeys?: { etherscan, opensea, coingecko, walletconnect },
});
```

`createMetroClient` returns a `MetroClient`:

```ts
export interface MetroClient {
  readonly accounts: AccountsModule;
  readonly messages: MessagesModule;
  readonly channels: ChannelsModule;
  readonly wallet: WalletModule;
  readonly governance: GovernanceModule;  // Snapshot
  readonly railgun: RailgunModule;         // present only if transport supplied
  readonly identity: IdentityModule;       // ENS, inbox<->eth, peer profiles
  readonly events: EventBus;               // typed subscriptions
  destroy(): Promise<void>;                // tear down streams + caches
}
```

### 4.2 Module namespacing + typed methods

Every domain is a namespace of async, fully-typed methods. Examples:

```ts
// Accounts (registry rules; secure I/O is delegated to secureStorage)
metro.accounts.list(): Promise<Account[]>;
metro.accounts.active(): Promise<Account | null>;
metro.accounts.create(opts?: { label?: string }): Promise<Account>;
metro.accounts.import(input: { privateKey?: Hex; mnemonic?: string }): Promise<Account>;
metro.accounts.connectWalletConnect(uri: string): Promise<Account>;
metro.accounts.switch(id: string): Promise<void>;
metro.accounts.remove(id: string): Promise<void>;

// Messages (shaping + orchestration; the transport does the encrypted I/O)
metro.messages.list(channelId: string, opts?: PageOpts): Promise<HistoryEntry[]>;
metro.messages.send(channelId: string, text: string): Promise<HistoryEntry>;
metro.messages.sendPoll(channelId: string, poll: PollInput): Promise<HistoryEntry>;
metro.messages.requestSignature(channelId: string, req: SignatureRequestInput): Promise<HistoryEntry>;
metro.messages.requestTransaction(channelId: string, tx: TxRequestInput): Promise<HistoryEntry>;
metro.messages.react(channelId: string, messageId: string, emoji: string): Promise<void>;
metro.messages.stream(channelId: string, on: (m: HistoryEntry) => void): Unsubscribe;

// Channels (groups, DMs, labels, github links, metadata)
metro.channels.list(): Promise<Channel[]>;
metro.channels.openDm(address: string): Promise<Channel>;
metro.channels.createGroup(input: { addresses: string[]; name?: string }): Promise<Channel>;
metro.channels.addMembers(channelId: string, addresses: string[]): Promise<void>;
metro.channels.setLabels(channelId: string, labels: string[]): Promise<void>;
metro.channels.setGithub(channelId: string, url: string): Promise<void>;
metro.channels.suggestLabels(channelId: string): Promise<string[]>;

// Wallet (signing orchestration over the SignerTransport)
metro.wallet.address(): Promise<string>;
metro.wallet.signMessage(message: string): Promise<string>;
metro.wallet.signTypedData(data: Eip712TypedData): Promise<string>;

// Governance (Snapshot)
metro.governance.getProfile(address: string): Promise<SnapshotProfile | null>;
metro.governance.updateProfile(profile: ProfileInput): Promise<void>;
metro.governance.listProposals(query: ProposalQuery): Promise<Proposal[]>;
metro.governance.vote(input: VoteInput): Promise<void>;

// Railgun (private balances + shield/unshield/transfer)
metro.railgun.balances(): Promise<TokenBalance[]>;
metro.railgun.shield(input: ShieldInput): Promise<TxResult>;
metro.railgun.unshield(input: UnshieldInput): Promise<TxResult>;
metro.railgun.transfer(input: PrivateTransferInput): Promise<TxResult>;

// Identity (ENS, inbox<->eth, peer profiles, stamp avatars)
metro.identity.resolveEns(name: string): Promise<string | null>;
metro.identity.reverseEns(address: string): Promise<string | null>;
metro.identity.inboxToAddress(inboxId: string): Promise<string | null>;
metro.identity.peerProfile(address: string): Promise<PeerProfile | null>;
metro.identity.avatarUrl(address: string, size?: number): string;
```

### 4.3 Events / subscriptions

A single typed event bus plus per-call `stream()` helpers that return an
`Unsubscribe`. No EventEmitter string soup - a discriminated union of events so
agents and TS both get exhaustiveness.

```ts
type MetroEvent =
  | { type: 'message'; channelId: string; message: HistoryEntry }
  | { type: 'channel.updated'; channel: Channel }
  | { type: 'account.switched'; account: Account }
  | { type: 'railgun.balance'; balances: TokenBalance[] }
  | { type: 'sync.state'; state: SyncState };

metro.events.on<T extends MetroEvent['type']>(
  type: T,
  handler: (e: Extract<MetroEvent, { type: T }>) => void,
): Unsubscribe;
```

### 4.4 Error model

Typed error classes with a stable `.code`, never bare strings. Lets agents
branch on failures and lets the app map them to UI/toasts.

```ts
class MetroError extends Error { readonly code: MetroErrorCode; readonly cause?: unknown; }
type MetroErrorCode =
  | 'NO_ACTIVE_ACCOUNT' | 'WALLETCONNECT_SIGN_REQUIRED' | 'TRANSPORT_UNAVAILABLE'
  | 'RAILGUN_NOT_READY' | 'NOT_A_MEMBER' | 'RATE_LIMITED' | 'NETWORK' | 'INVALID_INPUT';
```

### 4.5 Tree-shakeability

Keep the existing subpath exports (`@metro-labs/client/xmtp/humanize` etc) for
call-sites that want only pure helpers with no client. The factory + modules are
also exported per-module so a consumer that only needs governance does not pull
in Railgun. Modules are lazy: `metro.railgun` is constructed on first access and
absent if no transport is supplied, so the Railgun protocol code is not in the
bundle unless used.

### 4.6 Why this suits AI agents

- One discoverable typed surface: `metro.<domain>.<verb>(...)`, every method
  documented with TSDoc, so an agent reading the `.d.ts` can call it correctly
  without reading implementation.
- No hidden global state: the client is explicit and injectable, so an agent can
  construct one with a Node signer + Node storage and drive Metro headlessly
  (exactly the daemon/agent use case).
- Typed inputs/outputs + discriminated events + typed errors give agents
  machine-checkable contracts and exhaustive branching.
- Pure subpath helpers let an agent shape/humanize content without any
  transport at all.

## 5. Usage examples

### Dev (React Native app)

```ts
const metro = createMetroClient({
  signer: rnSigner,                 // wraps viem key / WalletConnect
  storage: asyncStorageAdapter,
  secureStorage: secureStoreAdapter,
  transports: { messaging: xmtpRnAdapter, railgun: nodejsMobileAdapter },
  env: 'production',
});

const channels = await metro.channels.list();
const unsub = metro.messages.stream(channels[0].id, (m) => render(m));
await metro.messages.send(channels[0].id, 'gm');
```

### AI agent (headless Node)

```ts
const metro = createMetroClient({
  signer: nodeViemSigner(process.env.AGENT_KEY),
  storage: fsStorage('./state'),
  secureStorage: fsStorage('./secrets'),
  transports: { messaging: nodeXmtpAdapter },
  env: 'production',
});

const dm = await metro.channels.openDm('0x42e1...39df');
await metro.messages.send(dm.id, 'Build finished. PR is up.');
metro.events.on('message', (e) => maybeReply(e.message));
```

## 6. Staged migration plan (no big-bang)

Each stage ships independently, keeps `apps/app` working via thin adapters, and
is its own PR. The app imports from the SDK incrementally; old `lib/*` modules
become re-export shims that delegate to the SDK until every call-site is moved,
then the shim is deleted.

- Stage 0 (this issue): approve THIS proposal. Land the interfaces
  (`Storage`, `SecureStorage`, `MessagingTransport`, `SignerTransport`,
  `RailgunTransport`) and the `createMetroClient` skeleton with empty modules.
  No behavior change.
- Stage 1 - pure helpers (lowest risk): move the already-pure modules with no
  transport needs: `ens`, `etherscan`, `opensea`, `coingecko`, `embedDetect`,
  `githubDetect`, `mdParser`, the XMTP humanize/preview helpers, the custom
  codecs' wire shapes. App `lib/*` becomes re-export shims.
- Stage 2 - identity + governance: `identity` module (inbox<->eth, ENS, peer
  profiles, stamp) and `governance` module (consolidate the Snapshot logic that
  is already half in the package). Read-only first, then writes.
- Stage 3 - accounts + wallet behind interfaces: move the registry RULES into
  `accounts`/`wallet` modules; `apps/app` provides the `SecureStorage` +
  `SignerTransport` impls (expo-secure-store, viem, WalletConnect). XMTP db
  paths stay app-side.
- Stage 4 - messaging + channels behind MessagingTransport: move envelope
  mapping, send orchestration, labels, github, feed ordering. `apps/app` wraps
  `@xmtp/react-native-sdk` as the `MessagingTransport`. The `use*` hooks become
  thin wrappers over `metro.messages` / `metro.channels`.
- Stage 5 - Railgun behind RailgunTransport: move the SDK/protocol/bridge-wire
  layer; `apps/app` keeps only `nodejsMobile.ts` + engine boot as the
  transport. Highest risk, so last (see Railgun branch isolation note).
- Stage 6 - cleanup: delete the re-export shims, enforce the no-react-native
  lint rule on `packages/client` in CI, document the SDK.

Risk controls: every stage is additive (SDK gains a module, app gains an
adapter, old path keeps working as a shim), so we can pause/revert at any stage
without breaking the app. The served branch stays buildable throughout. No
native module version bumps ride along (rn-screens / APK sequencing rules hold).

## 7. Open questions for Less

- Package name: keep `@metro-labs/client`, or split a `@metro-labs/sdk`?
- Should the web client (`apps/ui`) adopt `createMetroClient` too, or keep
  consuming only the pure subpath helpers?
- Is a headless Node adapter set in scope now (for the daemon/agents), or
  RN-first and Node later?
