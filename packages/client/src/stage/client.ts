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
import { fetchActivity, fetchActivityAllChains } from '../api/etherscan';
import { getNfts, getNftsAcrossChains, NFT_CHAIN_IDS } from '../api/opensea';
import { getErc20UsdPrices, getSimplePrices } from '../api/coingecko';
import {
  resolveDomain,
  lookupName,
  isAddressLike,
  isDomainLike,
  resolveSearchInputToAddress,
} from '../stamp/resolve';
import { shortAddress, stampAvatarUrl } from '../identity/format';
import { fetchAssetRows, type FetchAssetRowsOptions } from '../wallet/balances';
import { fmtUsd, fmtBalance, splitUsd } from '../wallet/format';
import {
  XMTP_USER_PREFIX, lineOfConv, lineOfDmPeer, convIdOfLine, metroDmPeerOf, metroConvIdOf,
} from '../xmtp/line';
import { mapDecodedToEnvelope } from '../xmtp/envelope';
import {
  buildReaction, buildVote, buildReply, buildStaticAttachment,
} from '../xmtp/builders';
import { InboxEthCache, resolveInboxEthCached, primeInboxEthCache } from '../xmtp/inboxCache';
import {
  shieldPrivateKeyMessage, ensureProviderLoaded,
  populateShieldBaseToken, populateShieldErc20,
  gasEstimateTransfer, generateTransferProof, populateProvedTransfer,
  gasEstimateUnshield, generateUnshieldProof, populateProvedUnshield,
} from '../railgun';
import type { MessagingTransport, RailgunTransport, StageApiKeys, StageClientOptions, StageEnv } from './interfaces';
import type {
  IdentityModule, ApiModule, WalletModule, MessagesModule, RailgunModule, StageClient,
} from './client.types';

// Re-export the module interfaces so existing `./client` type imports keep working.
export type {
  IdentityModule, ApiModule, WalletModule, MessagesModule, RailgunModule, StageClient,
} from './client.types';

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

  const railgunTransport: RailgunTransport | undefined = options.transports?.railgun;
  const requireRailgun = (): RailgunTransport => {
    if (!railgunTransport) {
      throw new Error('Stage client: no railgun transport injected (transports.railgun).');
    }
    return railgunTransport;
  };
  /** Bind the injected native dispatcher to the pure frame builders. */
  const dispatch = <T = unknown>(method: string, args?: readonly unknown[]): Promise<T> =>
    requireRailgun().dispatch<T>(method, args);

  const railgun: RailgunModule = {
    ready: () => requireRailgun().ready(),
    shieldPrivateKeyMessage: () => shieldPrivateKeyMessage(dispatch),
    ensureProviderLoaded: (cfg, networkName) => ensureProviderLoaded(dispatch, cfg, networkName),
    populateShieldBaseToken: params => populateShieldBaseToken(dispatch, params),
    populateShieldErc20: params => populateShieldErc20(dispatch, params),
    gasEstimateTransfer: params => gasEstimateTransfer(dispatch, params),
    generateTransferProof: params => generateTransferProof(dispatch, params),
    populateProvedTransfer: params => populateProvedTransfer(dispatch, params),
    gasEstimateUnshield: params => gasEstimateUnshield(dispatch, params),
    generateUnshieldProof: params => generateUnshieldProof(dispatch, params),
    populateProvedUnshield: params => populateProvedUnshield(dispatch, params),
  };

  return { env, identity, api, wallet, messages, railgun };
}
