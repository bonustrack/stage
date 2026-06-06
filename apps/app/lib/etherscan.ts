/** Re-export shim: Etherscan v2 activity helper moved into the
 *  framework-agnostic Stage SDK (@metro-labs/client). Kept here so existing
 *  app imports stay stable. EXPO_PUBLIC_ETHERSCAN_API_KEY still overrides the
 *  default read key. */
export {
  fetchActivity,
  fetchActivityAllChains,
  ACTIVITY_CHAINS,
  type EtherscanTx,
  type ActivityRow,
} from '@metro-labs/client/api/etherscan';
