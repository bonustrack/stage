/** @file Pure, framework-agnostic ZeroDev/Kernel protocol constants (EntryPoint v0.7, Kernel v3.1 ERC-7579, Base mainnet 8453) as the single source of truth; the host builds the SDK's branded values from these plain strings. */

/** Base mainnet chain id — the smart account + its XMTP identity are chain-bound to Base. Threaded through the SCW XMTP signer (getChainId 8453n). */
export const SCW_CHAIN_ID = 8453;
export const SCW_CHAIN_ID_BIGINT = 8453n;

/** EntryPoint version (v0.7). The host turns this into the branded EntryPointType via `getEntryPoint(ENTRY_POINT_VERSION)`. */
export const ENTRY_POINT_VERSION = '0.7' as const;

/** Kernel version (v3.1, ERC-7579 modular) as the SDK's string literal — the host maps it to the branded `KERNEL_V3_1` constant. */
export const KERNEL_VERSION_STRING = '0.3.1' as const;
