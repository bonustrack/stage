/** Pure ZeroDev / Kernel configuration constants, framework-agnostic. The host
 *  (apps/app/lib/zerodev) supplies the RPC URL + viem clients; the immutable
 *  protocol choices live here so they have one source of truth.
 *
 *  Locked choices (see docs/zerodev-wallet-spec.md): EntryPoint v0.7, Kernel
 *  v3.1 (ERC-7579 modular), Base mainnet (8453).
 *
 *  This package is intentionally framework-agnostic and does NOT depend on
 *  `@zerodev/sdk` (it is not in this package's dependency closure). The BRANDED
 *  EntryPointType / kernel-version values that the SDK's typed APIs require are
 *  built host-side in apps/app/lib/zerodev/config.ts via `getEntryPoint` /
 *  `KERNEL_V3_1` — keyed off the plain string constants below, so the protocol
 *  choice still has a single source of truth here. */

/** Base mainnet chain id — the smart account + its XMTP identity are chain-bound
 *  to Base. Threaded through the SCW XMTP signer (getChainId 8453n). */
export const SCW_CHAIN_ID = 8453;
export const SCW_CHAIN_ID_BIGINT = 8453n;

/** EntryPoint version (v0.7). The host turns this into the branded
 *  EntryPointType via `getEntryPoint(ENTRY_POINT_VERSION)`. */
export const ENTRY_POINT_VERSION = '0.7' as const;

/** Kernel version (v3.1, ERC-7579 modular) as the SDK's string literal — the
 *  host maps it to the branded `KERNEL_V3_1` constant. */
export const KERNEL_VERSION_STRING = '0.3.1' as const;
