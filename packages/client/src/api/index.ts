/** @file Barrel re-exporting the pure HTTP API clients with no platform deps (ENS, Etherscan, OpenSea, CoinGecko), individually so call-sites keep imports narrow and aggregated by the Stage client's api/identity namespaces. */

export { resolveEnsName } from './ens';
export {
  fetchActivity,
  fetchActivityAllChains,
  ACTIVITY_CHAINS,
  type EtherscanTx,
  type ActivityRow,
} from './etherscan';
export {
  getNfts,
  getNftsAcrossChains,
  NFT_CHAIN_IDS,
  type Nft,
} from './opensea';
export {
  getErc20UsdPrices,
  getSimplePrices,
  type CgPrice,
} from './coingecko';
