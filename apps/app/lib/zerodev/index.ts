/** ZeroDev smart-account wallet — host module barrel (phase 1).
 *
 *  See docs/zerodev-wallet-spec.md. Phase 1 = mnemonic + HD-derived owner +
 *  Kernel account creation (ECDSA always; passkey gated behind a new APK) +
 *  the opt-in SCW XMTP identity cutover. Lazy-deploy, guardians, session keys,
 *  recovery and the onboarding UI are phases 2-3. */

export { ensureMnemonic, getMnemonic, hasMnemonic, setMnemonic } from './mnemonic';
export { passkeysAvailable } from './native';
export { zerodevConfigured, zerodevRpcUrl } from './env';
export { createSmartAccount, type CreateSmartAccountOpts } from './create';
export { kernelClientForRecord } from './kernelForRecord';
export { scwSigner } from './scwSigner';
export { makePublicClient, makeKernelClient } from './client';
export { createEcdsaKernel, createPasskeyKernel } from './account';
