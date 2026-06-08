/** Re-export shim: Etherscan v2 activity helper moved into the
 *  framework-agnostic Stage SDK (@stage-labs/client). Kept here so existing
 *  app imports stay stable. EXPO_PUBLIC_ETHERSCAN_API_KEY still overrides the
 *  default read key. */
export {
  fetchActivityAllChains,
  type ActivityRow,
} from '@stage-labs/client/api/etherscan';
