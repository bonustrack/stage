/** @file Barrel for the ZeroDev smart-account wallet module, re-exporting only the symbols consumed via the `lib/zerodev` path (keyring, account creation, kernel rebuild, passkey enable/disable, guardian recovery); add a name only when a caller imports it from here. */
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
