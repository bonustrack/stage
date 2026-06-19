/**
 * @file Barrel for the ZeroDev smart-account wallet module, re-exporting only the symbols consumed via the `lib/zerodev` path (keyring, account creation, kernel rebuild, passkey enable/disable, and guardian recovery).
 */

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
