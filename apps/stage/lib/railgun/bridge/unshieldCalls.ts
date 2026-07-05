import { sdk } from './sdk';
import {
  gasEstimateUnshield as gasEstimateUnshieldSdk,
  generateUnshieldProof as generateUnshieldProofSdk,
  populateProvedUnshield as populateProvedUnshieldSdk,
} from '@stage-labs/client/railgun';

export type { UnshieldGasDetails, UnshieldErc20Recipient } from '@stage-labs/client/railgun';

export function gasEstimateUnshield(
  params: Parameters<typeof gasEstimateUnshieldSdk>[1],
): ReturnType<typeof gasEstimateUnshieldSdk> {
  return gasEstimateUnshieldSdk(sdk, params);
}

export function generateUnshieldProof(
  params: Parameters<typeof generateUnshieldProofSdk>[1],
): ReturnType<typeof generateUnshieldProofSdk> {
  return generateUnshieldProofSdk(sdk, params);
}

export function populateProvedUnshield(
  params: Parameters<typeof populateProvedUnshieldSdk>[1],
): ReturnType<typeof populateProvedUnshieldSdk> {
  return populateProvedUnshieldSdk(sdk, params);
}
