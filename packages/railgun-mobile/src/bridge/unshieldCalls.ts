/** RN-side UNSHIELD bridge wrappers - thin shims over the pure frame builders in
 *  @stage-labs/client/railgun, bound to THIS binary's native `sdk()` dispatcher.
 *  No logic is duplicated: the wire protocol lives in the SDK; the native channel
 *  (nodejsMobile) stays here. The call sites keep their no-dispatch signatures. */
import { sdk } from './sdk';
import {
  gasEstimateUnshield as gasEstimateUnshieldSdk,
  generateUnshieldProof as generateUnshieldProofSdk,
  populateProvedUnshield as populateProvedUnshieldSdk,
} from '@stage-labs/client/railgun';

export type { UnshieldGasDetails, UnshieldErc20Recipient } from '@stage-labs/client/railgun';

/** Gas estimate for an unproven unshield (self-broadcast). */
export function gasEstimateUnshield(
  params: Parameters<typeof gasEstimateUnshieldSdk>[1],
): ReturnType<typeof gasEstimateUnshieldSdk> {
  return gasEstimateUnshieldSdk(sdk, params);
}

/** Generate the Groth16 unshield proof (cached in the host for the populate step). */
export function generateUnshieldProof(
  params: Parameters<typeof generateUnshieldProofSdk>[1],
): ReturnType<typeof generateUnshieldProofSdk> {
  return generateUnshieldProofSdk(sdk, params);
}

/** Populate the proved unshield into a signable tx (uses the cached proof). */
export function populateProvedUnshield(
  params: Parameters<typeof populateProvedUnshieldSdk>[1],
): ReturnType<typeof populateProvedUnshieldSdk> {
  return populateProvedUnshieldSdk(sdk, params);
}
