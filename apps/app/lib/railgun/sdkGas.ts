/** Gas-detail helper for Railgun transactions. Each shield/transfer/unshield
 *  call wants a `TransactionGasDetails` for both the dummy-proof estimate and
 *  the final populated tx. We build it from the network default EVM gas type +
 *  the engine polling provider's live fee data. Coarse on purpose (first pass);
 *  tighter fee math is a second-pass refinement. */

import {
  EVMGasType, NETWORK_CONFIG,
  type NetworkName, type TransactionGasDetails,
} from '@railgun-community/shared-models';
import { requireWalletApi } from './sdkApi';

/** ~2 gwei fallback so a dummy estimate never divides by zero. */
const FALLBACK = 2_000_000_000n;

/** Build TransactionGasDetails for a network from its EVM gas type + live fee data. */
export async function buildGasDetails(
  networkName: NetworkName,
  gasEstimate: bigint,
): Promise<TransactionGasDetails> {
  const evmGasType = NETWORK_CONFIG[networkName].defaultEVMGasType;
  let maxFeePerGas = FALLBACK;
  let maxPriorityFeePerGas = 1_000_000_000n;
  let gasPrice = FALLBACK;
  try {
    const fee = await requireWalletApi().getPollingProviderForNetwork(networkName).getFeeData();
    if (fee.maxFeePerGas != null) maxFeePerGas = fee.maxFeePerGas;
    if (fee.maxPriorityFeePerGas != null) maxPriorityFeePerGas = fee.maxPriorityFeePerGas;
    if (fee.gasPrice != null) gasPrice = fee.gasPrice;
  } catch { /* keep fallbacks — estimate still runs with a sane non-zero price */ }

  if (evmGasType === EVMGasType.Type2) {
    return { evmGasType, gasEstimate, maxFeePerGas, maxPriorityFeePerGas };
  }
  if (evmGasType === EVMGasType.Type1) {
    return { evmGasType, gasEstimate, gasPrice };
  }
  return { evmGasType: EVMGasType.Type0, gasEstimate, gasPrice };
}
