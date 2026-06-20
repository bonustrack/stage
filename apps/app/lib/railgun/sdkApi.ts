
import type * as WalletSdk from '@railgun-community/wallet';

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

export function requireWalletApi(): RailgunWalletApi {
  const api = getWalletApi();
  if (!api) throw new Error('Railgun SDK unavailable on this build');
  return api;
}
