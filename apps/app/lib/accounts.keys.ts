/** @file Re-export layer over the keyring for account private-key access (signer, reveal) plus the pure key rules from the Stage SDK. */
// Account-registry key helpers — now a thin re-export layer over the KEYRING
// (lib/zerodev/keyring), the single chokepoint for all private-key access.
//
// This module used to read expo-secure-store private keys directly; that moved
// into the keyring so the raw key lives behind ONE enforced gateway (see
// SECURITY.md + the eslint guard). Here we only re-export the keyring's signer +
// the framework-agnostic PURE rules from the Stage SDK (normalizePk etc. touch
// no storage / no secrets), so existing call sites stay stable.

import { getViemAccount, revealPrivateKey } from './zerodev/keyring';

export { getViemAccount };

/** Read the raw private key for an account id. This is an EXPORT/REVEAL path — callers (the "Export private key" UI) gate it behind a destructive warning Alert. Delegates to the keyring's single reveal accessor. */
export const getPrivateKey = revealPrivateKey;

/** PURE rules only (no storage / no secrets). The PK storage-key CONSTANTS (PK_PREFIX / LEGACY_PK_KEY) are deliberately NOT re-exported here — they live solely inside the keyring, and the eslint guard forbids importing them elsewhere. */
export { canExportPrivateKey } from '@stage-labs/client/accounts/keys';
