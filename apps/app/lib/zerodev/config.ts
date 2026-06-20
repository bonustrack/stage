/** @file Host-side ZeroDev config exposing the branded @zerodev/sdk protocol constants (ENTRY_POINT v0.7, Kernel v3.1, Base 8453), built from the framework-agnostic string choices in @stage-labs/client/zerodev/config so the pure client package keeps no @zerodev/sdk dependency. */

import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { ENTRY_POINT_VERSION } from '@stage-labs/client/zerodev/config';

export { SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';

/** EntryPoint v0.7 ({ address, version }) — the branded EntryPointType. */
export const ENTRY_POINT = getEntryPoint(ENTRY_POINT_VERSION);

/** Kernel v3.1 (ERC-7579 modular) — the branded kernel-version constant. */
export const KERNEL_VERSION = KERNEL_V3_1;
