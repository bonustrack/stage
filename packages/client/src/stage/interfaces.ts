/** Dependency-inversion interfaces for the Stage client.
 *
 *  packages/client has ZERO react-native / expo imports. The platform-specific
 *  pieces (key-value storage, hardware-backed secure storage, the encrypted
 *  messaging transport, the wallet signer, the Railgun nodejs-mobile bridge)
 *  are defined here as INTERFACES and injected by the host at construction
 *  time. apps/app supplies the React Native implementations; the web client
 *  supplies browser ones; a Node agent supplies its own.
 *
 *  Stage 1 only WIRES the API + identity namespaces, which need none of these
 *  transports. The interfaces below are declared so hosts can start adapting
 *  their RN code behind them; the messaging / signer / railgun modules are
 *  migrated in later stages (see PROPOSAL.md + stage/index.ts notes). They are
 *  intentionally minimal: only the methods the app actually uses get added as
 *  each module is migrated, never speculative surface. */

/** A tiny async key-value contract. RN backs it with AsyncStorage; web with
 *  localStorage / IndexedDB; Node with fs. */
export interface Storage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

/** Same shape as Storage, but the platform promises hardware-backed storage
 *  for key material (RN -> secure enclave / Android keystore via
 *  expo-secure-store). Kept as a distinct type so the SDK can require the
 *  stronger guarantee where key material is involved. */
export type SecureStorage = Storage;

/** EIP-712 typed-data payload the SDK builds and hands to the signer. */
export interface Eip712TypedData {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

/** A transaction request the SDK builds and hands to the signer/transport. */
export interface TxRequest {
  to: string;
  data?: string;
  value?: string;
  chainId?: number;
}

/** Signing happens on the wallet / native side. The SDK builds the payloads
 *  (typed data, personal messages, tx calls) and hands them to the transport
 *  to sign. Covers local viem keys AND WalletConnect.
 *
 *  NOTE: not wired in Stage 1 (no signer-dependent module is migrated yet);
 *  declared for the wallet/messaging stages. */
export interface SignerTransport {
  address(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTypedData(typedData: Eip712TypedData): Promise<string>;
  sendTransaction?(tx: TxRequest): Promise<{ hash: string }>;
}

/** The SDK owns conversation/message SHAPING (line URIs, envelope mapping,
 *  outbound payload builders, the inbox->eth cache RULE); the transport owns the
 *  encrypted network + the native client (@xmtp/react-native-sdk on RN). The SDK
 *  never sees keys and never imports the native client.
 *
 *  Only methods the app actually drives through the SDK are declared — the rest
 *  of the native XMTP surface (streaming, consent, group admin, swarm
 *  attachments) stays entirely in apps/app, which holds the native client. */
export interface MessagingTransport {
  /** The local user's inbox id. */
  selfInboxId(): Promise<string>;
  /** The local user's primary ETH address. */
  selfAddress(): Promise<string>;
  /** Batch-resolve inbox ids -> ETH address over the network (one call). Backs
   *  the SDK's cache-first `client.messages.resolveInboxEth`; missing ids may be
   *  absent from the returned map. Implemented on the native client's
   *  `inboxStates(true, ids)`. */
  inboxEthAddresses(inboxIds: string[]): Promise<Record<string, string>>;
}

/** The Railgun nodejs-mobile bridge. The SDK owns the typed request FRAMES (the
 *  pure wire protocol - shield / transfer / unshield call shapes, bigint
 *  wire-encoding); the transport ships them over the platform bridge and returns
 *  the host-serialized responses. The native pieces (engine boot, the embedded
 *  Node Groth16 prover, the nodejs-mobile channel) stay entirely in apps/app
 *  behind this interface - the SDK never imports the native module.
 *
 *  `dispatch` is the generic whitelisted-SDK invoker (apps/app backs it with its
 *  bridge `sdk(method, args)` over `rawCall`); `ready` resolves once the embedded
 *  Node runtime can serve calls (the boot-race ready-gate). Only the surface the
 *  app actually drives through the SDK is declared. */
export interface RailgunTransport {
  /** Invoke a whitelisted @railgun-community/wallet method by name with
   *  positional args; result is the host-serialized return (bigint -> string). */
  dispatch<T = unknown>(method: string, args?: readonly unknown[]): Promise<T>;
  /** Resolves once the embedded Node runtime is ready to serve calls. */
  ready(): Promise<void>;
}

/** Network environment selector, mirroring the app's XMTP env values. */
export type StageEnv = 'production' | 'dev' | 'local';

/** Optional API keys. When omitted, each module falls back to the shared
 *  read-only default keys baked into the API helpers. */
export interface StageApiKeys {
  etherscan?: string;
  opensea?: string;
  coingecko?: string;
  walletconnect?: string;
}

/** Construction options for {@link createStageClient}. Storage / secureStorage
 *  / transports are OPTIONAL in Stage 1 because the wired namespaces (identity,
 *  api) don't use them yet; they become required as their modules land. */
export interface StageClientOptions {
  signer?: SignerTransport;
  storage?: Storage;
  secureStorage?: SecureStorage;
  transports?: {
    messaging?: MessagingTransport;
    railgun?: RailgunTransport;
  };
  env?: StageEnv;
  apiKeys?: StageApiKeys;
}
