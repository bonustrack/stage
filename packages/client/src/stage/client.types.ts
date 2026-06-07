/** Stage client module interfaces: the typed surface of each namespace on the
 *  client returned by `createStageClient`. Split out of client.ts so the
 *  factory implementation stays under the 200-line cap; the implementation
 *  re-exports these so existing `./client` type imports keep working. */

import type { ActivityRow } from '../api/etherscan';
import type { Nft } from '../api/opensea';
import type { CgPrice } from '../api/coingecko';
import type { TokenLogoResolver } from '../wallet/balances';
import type { AssetRow } from '../wallet/assets';
import type { DecodedMessageView } from '../xmtp/envelope';
import type { ReactionPayload, ReplyPayload, StaticAttachmentPayload } from '../xmtp/builders';
import type {
  FallbackProviderConfig, PopulateResult,
  TransferGasDetails, TransferErc20Recipient,
  UnshieldGasDetails, UnshieldErc20Recipient,
} from '../railgun';
import type { HistoryEntry } from '../types';
import type { StageEnv } from './interfaces';

/** Identity resolution: turn names/domains into addresses and back. All pure
 *  stamp.fyi-backed calls, available on every platform. */
export interface IdentityModule {
  /** Resolve an ENS name (mainnet) to an address, or null when unregistered.
   *  Throws on transport error (the search box surfaces it). */
  resolveEnsName(name: string): Promise<string | null>;
  /** Resolve any ENS-like domain on the given chain to an address, or null on
   *  miss / network failure (best-effort, never throws). */
  resolveDomain(domain: string, chainId?: number): Promise<string | null>;
  /** Reverse-resolve an address to its primary ENS-like name, or null. */
  lookupName(address: string): Promise<string | null>;
  /** Best-effort: take a free-form search query and return the resolved
   *  address if it is already an address or a domain stamp.fyi knows. */
  resolveSearchInputToAddress(query: string): Promise<string | null>;
  /** True when the input looks like a 0x 40-hex Ethereum address. */
  isAddressLike(input: string | undefined | null): input is string;
  /** True when the input looks like a tld'd handle stamp.fyi can resolve. */
  isDomainLike(input: string | undefined | null): input is string;
  /** Pretty-print an address as `0x1234…abcd`. */
  shortAddress(addr: string): string;
  /** stamp.fyi identicon URL for an address (display px, optional cache-bust). */
  avatarUrl(address: string, displayPx?: number, cacheBust?: string): string;
}

/** Read-only on-chain + market data the wallet surfaces use. API keys are
 *  bound at construction (falling back to the shared read keys). */
export interface ApiModule {
  /** Normal-tx activity for an address on one chain, newest-first. */
  fetchActivity(address: string, chainId?: number, limit?: number): Promise<ActivityRow[]>;
  /** Activity merged across the supported chains, newest-first. */
  fetchActivityAllChains(address: string, limit?: number): Promise<ActivityRow[]>;
  /** NFTs an address holds on one chain. */
  getNfts(address: string, chainId: string): Promise<Nft[]>;
  /** NFTs merged across chains (defaults to the wallet grid's chain set). */
  getNftsAcrossChains(address: string, chainIds?: string[]): Promise<Nft[]>;
  /** USD prices for ERC-20 contracts on a CoinGecko platform slug. */
  getErc20UsdPrices(platform: string, contracts: string[]): Promise<Record<string, CgPrice>>;
  /** USD prices by CoinGecko coin id (ETH = `ethereum`). */
  getSimplePrices(ids: string[]): Promise<Record<string, CgPrice>>;
}

/** Wallet: framework-agnostic balance/asset shaping + value formatting. Key
 *  storage + signing stay behind the injected SecureStorage / SignerTransport
 *  interfaces (wired in a later stage); these methods need neither. */
export interface WalletModule {
  /** Fetch + shape every tracked asset's balance + USD price for an address.
   *  The host injects a token-logo resolver (kit's stampTokenUrl on mobile). */
  fetchAssetRows(address: string, tokenLogo: TokenLogoResolver): Promise<AssetRow[]>;
  /** Format a USD number as a bare `$` string. */
  fmtUsd(v: number, maxFrac?: number): string;
  /** Format a decimal-string token balance for display. */
  fmtBalance(v: string): string;
  /** Split a formatted USD string into integer + decimal parts. */
  splitUsd(s: string): { int: string; dec: string };
}

/** Messaging: the framework-agnostic XMTP logic — `metro://` line URIs, the
 *  decoded-message -> HistoryEntry envelope mapper, outbound payload builders,
 *  and the cache-first inbox->eth resolver. The native @xmtp/react-native-sdk
 *  client stays in apps/app behind the injected MessagingTransport; this module
 *  is the pure orchestration the app re-uses. The line/envelope/builder helpers
 *  are pure and available even when no transport is injected; `resolveInboxEth`
 *  / `primeInboxEthCache` require the transport (they hit the network). */
export interface MessagesModule {
  /** Inbound "from" / DM-by-address URI prefix (`metro://xmtp/user/`). */
  readonly userPrefix: string;
  /** Build a `metro://xmtp/<convId>` conversation line. */
  lineOfConv(convId: string): string;
  /** Build a `metro://xmtp/user/<address>` DM-by-peer line. */
  lineOfDmPeer(address: string): string;
  /** Parse a conversation id out of an anchored `metro://xmtp/<convId>` line. */
  convIdOfLine(line: string): string | null;
  /** Find a DM peer address anywhere in a block of text, or null. */
  metroDmPeerOf(text?: string | null): string | null;
  /** Find a conversation id anywhere in a block of text, or null. */
  metroConvIdOf(text?: string | null): string | null;
  /** Map a decoded XMTP message (structural view) -> a HistoryEntry envelope. */
  envelopeOf(msg: DecodedMessageView, line: string): HistoryEntry;
  /** Build a reaction payload to hand to the native conv.send. */
  buildReaction(messageId: string, emoji: string, action?: 'added' | 'removed'): ReactionPayload;
  /** Build a poll-vote payload (reaction, schema:'custom'). */
  buildVote(pollMessageId: string, optionIndex: number, action?: 'added' | 'removed', questionIndex?: number): ReactionPayload;
  /** Build a text-reply payload. */
  buildReply(replyTo: string, text: string): ReplyPayload;
  /** Build a static (inline) attachment payload. */
  buildStaticAttachment(filename: string, mimeType: string, dataB64: string): StaticAttachmentPayload;
  /** Cache-first batch resolve of inbox ids -> ETH address (uses the transport
   *  for uncached ids only). Throws if no messaging transport was injected. */
  resolveInboxEth(inboxIds: string[]): Promise<Record<string, string>>;
  /** Pre-warm the inbox->eth cache for many ids in one transport call. No-op for
   *  already-cached ids; best-effort on fetch failure. Throws if no transport. */
  primeInboxEthCache(inboxIds: string[]): Promise<void>;
  /** Drop the inbox->eth cache (e.g. on account switch). */
  clearInboxEthCache(): void;
}

/** Railgun: the framework-agnostic private-balances logic - the typed bridge
 *  FRAME builders for shield / private-transfer / unshield. The SDK builds the
 *  whitelisted-SDK request frames (positional args + bigint wire-encoding) and
 *  interprets the host-serialized responses; the native nodejs-mobile bridge
 *  (engine boot, the embedded Groth16 prover, the channel) stays in apps/app
 *  behind the injected RailgunTransport. Every method ships its frame through
 *  `transport.dispatch`; all require the transport (they hit the bridge). The EOA
 *  signing + broadcast of the returned populated tx stays in apps/app (the SDK
 *  never sees the key). */
export interface RailgunModule {
  /** Resolves once the embedded Node runtime can serve calls (the boot-race
   *  ready-gate). Throws if no railgun transport was injected. */
  ready(): Promise<void>;
  /** The shield-private-key derivation message, signed by the EOA -> keccak. */
  shieldPrivateKeyMessage(): Promise<string>;
  /** Load the RPC provider + register the merkletree for `networkName` (idempotent
   *  per chainId for the session) before a shield. */
  ensureProviderLoaded(cfg: FallbackProviderConfig, networkName: string): Promise<void>;
  /** Populate a native-ETH (base-token) shield to the user's own 0zk. */
  populateShieldBaseToken(params: {
    txidVersion: string; networkName: string; railgunAddress: string;
    shieldPrivateKey: string; wrappedTokenAddress: string; amountWei: string;
  }): Promise<PopulateResult>;
  /** Populate an ERC20 shield to the user's own 0zk (needs a prior approve). */
  populateShieldErc20(params: {
    txidVersion: string; networkName: string; shieldPrivateKey: string;
    tokenAddress: string; amountWei: string; recipientAddress: string;
  }): Promise<PopulateResult>;
  /** Gas estimate for an unproven private transfer (self-broadcast). */
  gasEstimateTransfer(params: {
    txidVersion: string; networkName: string; railgunWalletID: string;
    encryptionKey: string; erc20Recipients: TransferErc20Recipient[];
    originalGasDetails: TransferGasDetails;
  }): Promise<{ gasEstimate: string }>;
  /** Generate the Groth16 transfer proof (cached in the host for populate). */
  generateTransferProof(params: {
    txidVersion: string; networkName: string; railgunWalletID: string;
    encryptionKey: string; erc20Recipients: TransferErc20Recipient[];
  }): Promise<void>;
  /** Populate the proved transfer into a signable tx (uses the cached proof). */
  populateProvedTransfer(params: {
    txidVersion: string; networkName: string; railgunWalletID: string;
    erc20Recipients: TransferErc20Recipient[]; gasDetails: TransferGasDetails;
  }): Promise<PopulateResult>;
  /** Gas estimate for an unproven unshield (self-broadcast). */
  gasEstimateUnshield(params: {
    txidVersion: string; networkName: string; railgunWalletID: string;
    encryptionKey: string; erc20Recipients: UnshieldErc20Recipient[];
    originalGasDetails: UnshieldGasDetails;
  }): Promise<{ gasEstimate: string }>;
  /** Generate the Groth16 unshield proof (cached in the host for populate). */
  generateUnshieldProof(params: {
    txidVersion: string; networkName: string; railgunWalletID: string;
    encryptionKey: string; erc20Recipients: UnshieldErc20Recipient[];
  }): Promise<void>;
  /** Populate the proved unshield into a signable tx (uses the cached proof). */
  populateProvedUnshield(params: {
    txidVersion: string; networkName: string; railgunWalletID: string;
    erc20Recipients: UnshieldErc20Recipient[]; gasDetails: UnshieldGasDetails;
  }): Promise<PopulateResult>;
}

/** The Stage client. New namespaces are added as later stages migrate their
 *  modules; the shape stays additive. */
export interface StageClient {
  readonly env: StageEnv;
  readonly identity: IdentityModule;
  readonly api: ApiModule;
  readonly wallet: WalletModule;
  readonly messages: MessagesModule;
  readonly railgun: RailgunModule;
}
