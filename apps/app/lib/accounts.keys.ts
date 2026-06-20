/** @file Thin re-export layer over the keyring (the single chokepoint for all private-key access) for account signer + reveal, plus the framework-agnostic pure key rules from the Stage SDK. */

import { getViemAccount, revealPrivateKey } from './zerodev/keyring';

export { getViemAccount };

/** Read the raw private key for an account id. This is an EXPORT/REVEAL path — callers (the "Export private key" UI) gate it behind a destructive warning Alert. Delegates to the keyring's single reveal accessor. */
export const getPrivateKey = revealPrivateKey;

/** PURE rules only (no storage / no secrets). The PK storage-key CONSTANTS (PK_PREFIX / LEGACY_PK_KEY) are deliberately NOT re-exported here — they live solely inside the keyring, and the eslint guard forbids importing them elsewhere. */
export { canExportPrivateKey } from '@stage-labs/client/accounts/keys';
