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

/** The Stage client. New namespaces are added as later stages migrate their
 *  modules; the shape stays additive. */
export interface StageClient {
  readonly env: StageEnv;
  readonly identity: IdentityModule;
  readonly api: ApiModule;
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

  return { env, identity, api };
}
