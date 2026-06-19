/** Host-side ZeroDev config: the BRANDED protocol constants the @zerodev/sdk
 *  typed APIs require, built from the framework-agnostic string choices in
 *  @stage-labs/client/zerodev/config (the single source of truth for the
 *  protocol VERSIONS — EntryPoint v0.7, Kernel v3.1, Base 8453).
 *
 *  The SDK dependency lives here (apps/app) and not in the pure client package,
 *  so the client package has no @zerodev/sdk in its dependency closure. Every
 *  host module imports the branded ENTRY_POINT / KERNEL_VERSION from here. */

import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { ENTRY_POINT_VERSION } from '@stage-labs/client/zerodev/config';

export { SCW_CHAIN_ID } from '@stage-labs/client/zerodev/config';

/** EntryPoint v0.7 ({ address, version }) — the branded EntryPointType. */
export const ENTRY_POINT = getEntryPoint(ENTRY_POINT_VERSION);

/** Kernel v3.1 (ERC-7579 modular) — the branded kernel-version constant. */
export const KERNEL_VERSION = KERNEL_V3_1;
