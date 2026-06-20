/** @file RN-side private-TRANSFER bridge wrappers (gas-estimate, proof, populate) — thin shims binding the pure @stage-labs/client/railgun builders to this binary's native `sdk()` dispatcher; the wire protocol lives in the SDK, the native channel stays here. */
import { sdk } from './sdk';
import {
  gasEstimateTransfer as gasEstimateTransferSdk,
  generateTransferProof as generateTransferProofSdk,
  populateProvedTransfer as populateProvedTransferSdk,
} from '@stage-labs/client/railgun';

export type { TransferGasDetails, TransferErc20Recipient } from '@stage-labs/client/railgun';

/** Gas estimate for an unproven private transfer (self-broadcast). */
export function gasEstimateTransfer(
  params: Parameters<typeof gasEstimateTransferSdk>[1],
): ReturnType<typeof gasEstimateTransferSdk> {
  return gasEstimateTransferSdk(sdk, params);
}

/** Generate the Groth16 transfer proof (cached in the host for the populate step). */
export function generateTransferProof(
  params: Parameters<typeof generateTransferProofSdk>[1],
): ReturnType<typeof generateTransferProofSdk> {
  return generateTransferProofSdk(sdk, params);
}

/** Populate the proved transfer into a signable tx (uses the cached proof). */
export function populateProvedTransfer(
  params: Parameters<typeof populateProvedTransferSdk>[1],
): ReturnType<typeof populateProvedTransferSdk> {
  return populateProvedTransferSdk(sdk, params);
}
