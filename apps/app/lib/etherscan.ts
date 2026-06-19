/**
 * @file Re-export shim for the Etherscan v2 fetchActivityAllChains helper, now in the Stage SDK (@stage-labs/client); EXPO_PUBLIC_ETHERSCAN_API_KEY still overrides the default read key.
 */
export {
  fetchActivityAllChains,
  type ActivityRow,
} from '@stage-labs/client/api/etherscan';
