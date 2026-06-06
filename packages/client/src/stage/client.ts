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
import { shortAddress, stampBoxAvatarUrl } from '../identity/format';
import { fetchAssetRows, type FetchAssetRowsOptions, type TokenLogoResolver } from '../wallet/balances';
import { fmtUsd, fmtBalance, splitUsd } from '../wallet/format';
import type { AssetRow } from '../wallet/assets';
import type { StageApiKeys, StageClientOptions, StageEnv } from './interfaces';

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

/** The Stage client. New namespaces are added as later stages migrate their
 *  modules; the shape stays additive. */
export interface StageClient {
  readonly env: StageEnv;
  readonly identity: IdentityModule;
  readonly api: ApiModule;
  readonly wallet: WalletModule;
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
    avatarUrl: stampBoxAvatarUrl,
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

  return { env, identity, api, wallet };
}
