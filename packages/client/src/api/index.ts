/** Pure HTTP API clients (no platform deps): ENS resolution, Etherscan
 *  activity, OpenSea NFTs, CoinGecko prices. Re-exported individually so
 *  call-sites can keep imports narrow, and aggregated by the Stage client's
 *  `api` / `identity` namespaces. */

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
