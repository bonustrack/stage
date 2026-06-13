/** Pure ZeroDev / Kernel configuration constants, framework-agnostic. The host
 *  (apps/app/lib/zerodev) supplies the RPC URL + viem clients; the immutable
 *  protocol choices live here so they have one source of truth.
 *
 *  Locked choices (see docs/zerodev-wallet-spec.md): EntryPoint v0.7, Kernel
 *  v3.1 (ERC-7579 modular), Base mainnet (8453). */

import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';

/** Base mainnet chain id — the smart account + its XMTP identity are chain-bound
 *  to Base. Threaded through the SCW XMTP signer (getChainId 8453n). */
export const SCW_CHAIN_ID = 8453;
export const SCW_CHAIN_ID_BIGINT = 8453n;

/** EntryPoint v0.7 ({ address, version }). */
export const ENTRY_POINT = getEntryPoint('0.7');

/** Kernel v3.1 (ERC-7579 modular). */
export const KERNEL_VERSION = KERNEL_V3_1;
