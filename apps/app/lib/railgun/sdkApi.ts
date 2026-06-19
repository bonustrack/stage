/** @file Lazy facade over the heavy @railgun-community/wallet runtime module, returning the typed SDK function subset (or null) so callers degrade to 'unavailable' on builds without native bits. */
/**
 * Lazy facade over the heavy @railgun-community/wallet runtime module.
 *
 *  The SDK is required LAZILY (never a top-level runtime import) so the Metro
 *  bundler / app eval never has to resolve it on a build without the native
 *  bits — mirroring lib/railgun/native.ts + components/VoiceMessage.decode.ts.
 *  Type-only imports (`import type`) are erased at compile time and are safe to
 *  keep static; only the runtime function objects come through here.
 *
 *  Callers must gate on isRailgunAvailable() first; getWalletApi() returns null
 *  when the module can't load, so every op degrades to 'unavailable' instead of
 *  throwing.
 */

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
