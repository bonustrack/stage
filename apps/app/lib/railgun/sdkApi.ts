/** @file Lazy facade over the heavy @railgun-community/wallet runtime module, requiring it lazily (type-only imports stay static) so builds without native bits never resolve it; getWalletApi returns null and callers gating on isRailgunAvailable degrade to 'unavailable' instead of throwing. */

import type * as WalletSdk from '@railgun-community/wallet';

/** The exact subset of the SDK surface lib/railgun uses, typed from the real module so signatures stay honest without a runtime import. */
export type RailgunWalletApi = Pick<
  typeof WalletSdk,
  | 'startRailgunEngine' | 'ArtifactStore' | 'getEngine' | 'loadProvider'
  | 'getPollingProviderForNetwork'
  | 'createRailgunWallet' | 'getRailgunAddress'
  | 'getShieldPrivateKeySignatureMessage'
  | 'gasEstimateForShield' | 'populateShield'
  | 'gasEstimateForUnprovenTransfer' | 'generateTransferProof' | 'populateProvedTransfer'
  | 'gasEstimateForUnprovenUnshield' | 'generateUnshieldProof' | 'populateProvedUnshield'
>;

let resolved = false;
let cached: RailgunWalletApi | null = null;

/** Lazily require the wallet SDK once. Returns null when unavailable; memoized. Never throws. */
function getWalletApi(): RailgunWalletApi | null {
  if (resolved) return cached;
  resolved = true;
  try {
    cached = require('@railgun-community/wallet') as RailgunWalletApi;
  } catch {
    cached = null;
  }
  return cached;
}

/** Get the SDK or throw a friendly error — for code paths already gated on availability that genuinely need it. */
export function requireWalletApi(): RailgunWalletApi {
  const api = getWalletApi();
  if (!api) throw new Error('Railgun SDK unavailable on this build');
  return api;
}
