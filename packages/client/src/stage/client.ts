/** createStageClient: the single typed entrypoint for the Stage SDK.
 *
 *  No globals, no hidden singletons. The client IS the state holder, so AI
 *  agents and tests can spin up isolated instances. Stage 1 wires only the
 *  framework-agnostic namespaces that need no platform transports:
 *
 *    - `identity`: ENS / domain <-> address resolution (stamp.fyi)
 *    - `api`:      read-only chain data (etherscan activity, opensea NFTs,
 *                  coingecko prices), with injected API keys
 *
 *  Messaging, wallet/signing, accounts, and Railgun are migrated in later
 *  stages and will hang off this same client object once their transports are
 *  defined. Only USED app logic is exposed; nothing speculative. */

import { resolveEnsName } from '../api/ens';
import {
  fetchActivity,
  fetchActivityAllChains,
  type ActivityRow,
} from '../api/etherscan';
import { getNfts, getNftsAcrossChains, NFT_CHAIN_IDS, type Nft } from '../api/opensea';
import {
  getErc20UsdPrices,
  getSimplePrices,
  type CgPrice,
} from '../api/coingecko';
import {
  resolveDomain,
  lookupName,
  isAddressLike,
  isDomainLike,
  resolveSearchInputToAddress,
} from '../stamp/resolve';
import { shortAddress, stampAvatarUrl } from '../identity/format';
import { fetchAssetRows, type FetchAssetRowsOptions, type TokenLogoResolver } from '../wallet/balances';
import { fmtUsd, fmtBalance, splitUsd } from '../wallet/format';
import type { AssetRow } from '../wallet/assets';
import {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroDmPeerOf, metroConvIdOf,
} from '../xmtp/line';
import { mapDecodedToEnvelope, type DecodedMessageView } from '../xmtp/envelope';
import {
  buildReaction, buildVote, buildReply, buildStaticAttachment,
  type ReactionPayload, type ReplyPayload, type StaticAttachmentPayload,
} from '../xmtp/builders';
import { InboxEthCache, resolveInboxEthCached, primeInboxEthCache } from '../xmtp/inboxCache';
import type { HistoryEntry } from '../types';
import type { MessagingTransport, StageApiKeys, StageClientOptions, StageEnv } from './interfaces';

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
  buildVote(pollMessageId: string, optionIndex: number, action?: 'added' | 'removed'): ReactionPayload;
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

/** The Stage client. New namespaces are added as later stages migrate their
 *  modules; the shape stays additive. */
export interface StageClient {
  readonly env: StageEnv;
  readonly identity: IdentityModule;
  readonly api: ApiModule;
  readonly wallet: WalletModule;
  readonly messages: MessagesModule;
}

export function createStageClient(options: StageClientOptions = {}): StageClient {
  const env: StageEnv = options.env ?? 'production';
  const keys: StageApiKeys = options.apiKeys ?? {};

  const identity: IdentityModule = {
    resolveEnsName,
    resolveDomain,
    lookupName,
    resolveSearchInputToAddress,
    isAddressLike,
    isDomainLike,
    shortAddress,
    avatarUrl: stampAvatarUrl,
  };

  const wallet: WalletModule = {
    fetchAssetRows: (address, tokenLogo) => {
      const o: FetchAssetRowsOptions = { tokenLogo, coingeckoKey: keys.coingecko };
      return fetchAssetRows(address, o);
    },
    fmtUsd,
    fmtBalance,
    splitUsd,
  };

  const api: ApiModule = {
    fetchActivity: (address, chainId, limit) =>
      fetchActivity(address, chainId, limit, keys.etherscan),
    fetchActivityAllChains: (address, limit) =>
      fetchActivityAllChains(address, limit, keys.etherscan),
    getNfts: (address, chainId) => getNfts(address, chainId, keys.opensea),
    getNftsAcrossChains: (address, chainIds = NFT_CHAIN_IDS) =>
      getNftsAcrossChains(address, chainIds, keys.opensea),
    getErc20UsdPrices: (platform, contracts) =>
      getErc20UsdPrices(platform, contracts, keys.coingecko),
    getSimplePrices: ids => getSimplePrices(ids, keys.coingecko),
  };

  const messagingTransport: MessagingTransport | undefined = options.transports?.messaging;
  const inboxEthCache = new InboxEthCache();
  const requireMessaging = (): MessagingTransport => {
    if (!messagingTransport) {
      throw new Error('Stage client: no messaging transport injected (transports.messaging).');
    }
    return messagingTransport;
  };

  const messages: MessagesModule = {
    userPrefix: XMTP_USER_PREFIX,
    lineOfConv,
    lineOfDmPeer,
    convIdOfLine,
    metroDmPeerOf,
    metroConvIdOf,
    envelopeOf: mapDecodedToEnvelope,
    buildReaction,
    buildVote,
    buildReply,
    buildStaticAttachment,
    resolveInboxEth: ids =>
      resolveInboxEthCached(inboxEthCache, requireMessaging().inboxEthAddresses, ids),
    primeInboxEthCache: ids =>
      primeInboxEthCache(inboxEthCache, requireMessaging().inboxEthAddresses, ids),
    clearInboxEthCache: () => inboxEthCache.clear(),
  };

  return { env, identity, api, wallet, messages };
}
