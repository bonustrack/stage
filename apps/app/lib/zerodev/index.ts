/** ZeroDev smart-account wallet — host module barrel (phase 1).
 *
 *  See docs/zerodev-wallet-spec.md. Phase 1 = mnemonic + HD-derived owner +
 *  Kernel account creation (ECDSA always; passkey gated behind a new APK) +
 *  the opt-in SCW XMTP identity cutover. Phase 2 = lazy-deploy + weighted
 *  guardian recovery (native timelock + veto, recovery over XMTP). Session keys
 *  / agent provisioning are parked (future). */

// This barrel re-exports ONLY the symbols consumed via the `lib/zerodev` path.
// Many submodule exports are imported directly from their source module (or via
// a lazy `import('./zerodev/<mod>')`) by callers/tests, so re-exporting them here
// too is dead surface — knip flags it. Add a name back here only when a caller
// imports it from `'../lib/zerodev'`.
export {
  restoreMnemonic, revealRecoveryPhrase, smartOwnerSigner,
} from './keyring';
export { passkeysAvailable } from './native';
export { zerodevConfigured } from './env';
export { createSmartAccount } from './create';
export { kernelClientForRecord } from './kernelForRecord';
export { enablePasskeyForRecord } from './enablePasskey';
export { removePasskeyFromRecord } from './disablePasskey';
export { kernelDeployedOnChain } from './client';
export {
  installGuardians, updateGuardians, signRecoveryApproval, cancelRecovery,
} from './recovery';
export { sendRecoveryApproval } from './recovery.comms';
