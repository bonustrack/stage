import { sdk } from './sdk';
import {
  gasEstimateTransfer as gasEstimateTransferSdk,
  generateTransferProof as generateTransferProofSdk,
  populateProvedTransfer as populateProvedTransferSdk,
} from '@stage-labs/client/railgun';

export type { TransferGasDetails, TransferErc20Recipient } from '@stage-labs/client/railgun';

export function gasEstimateTransfer(
  params: Parameters<typeof gasEstimateTransferSdk>[1],
): ReturnType<typeof gasEstimateTransferSdk> {
  return gasEstimateTransferSdk(sdk, params);
}

export function generateTransferProof(
  params: Parameters<typeof generateTransferProofSdk>[1],
): ReturnType<typeof generateTransferProofSdk> {
  return generateTransferProofSdk(sdk, params);
}

export function populateProvedTransfer(
  params: Parameters<typeof populateProvedTransferSdk>[1],
): ReturnType<typeof populateProvedTransferSdk> {
  return populateProvedTransferSdk(sdk, params);
}
