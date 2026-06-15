/** ZeroDev smart-account wallet — host module barrel (phase 1).
 *
 *  See docs/zerodev-wallet-spec.md. Phase 1 = mnemonic + HD-derived owner +
 *  Kernel account creation (ECDSA always; passkey gated behind a new APK) +
 *  the opt-in SCW XMTP identity cutover. Phase 2 = lazy-deploy + weighted
 *  guardian recovery (native timelock + veto, recovery over XMTP). Session keys
 *  / agent provisioning are parked (future). */

export {
  ensureMnemonic, hasMnemonic, restoreMnemonic, clearMnemonic, revealRecoveryPhrase,
  smartOwnerSigner, smartOwnerAddress, signOwnerMessage,
} from './keyring';
export { passkeysAvailable } from './native';
export { zerodevConfigured, zerodevRpcUrl, zerodevRpId } from './env';
export { createSmartAccount, type CreateSmartAccountOpts } from './create';
export { kernelClientForRecord } from './kernelForRecord';
export { enablePasskeyForRecord, type EnablePasskeyResult } from './enablePasskey';
export { removePasskeyFromRecord, swapRootToEcdsa, type RemovePasskeyResult } from './disablePasskey';
export { scwSigner } from './scwSigner';
export { makePublicClient, makeKernelClient, kernelDeployedOnChain } from './client';
export { createEcdsaKernel, createPasskeyKernel } from './account';
export {
  installGuardians, updateGuardians, signRecoveryApproval, executeRecovery,
  readPendingRotation, cancelRecovery, resumeWithNewOwner, recoveryCallData,
  callDataAndNonceHash, ProposalStatus,
} from './recovery';
export { sendRecoveryRequest, sendRecoveryApproval, parseRecovery } from './recovery.comms';
