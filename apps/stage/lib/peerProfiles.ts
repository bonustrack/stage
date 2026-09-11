import { useEffect, useReducer } from 'react';
import {
  ensurePeerProfiles,
  getPeerAvatar,
  peerProfileEntries,
  seedPeerProfiles,
  setOnchainProfileResolver,
  subscribePeerProfiles,
  type PeerProfileEntries,
} from '@stage-labs/client/identity/peerProfiles';
import { avatarCacheKey, makeProfileClients, resolveOnchainProfile } from '@stage-labs/client/identity/onchainProfile';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { PersistentStore } from './cache';

export {
  isPeerResolved,
  getPeerName,
  getPeerDisplayName,
  getPeerHandle,
  getPeerDescription,
  getPeerAvatar,
  getPeerProfileSource,
  invalidatePeerProfile,
} from '@stage-labs/client/identity/peerProfiles';

const profileClients = makeProfileClients(broviderRpc);
setOnchainProfileResolver((address) => resolveOnchainProfile(profileClients, address));

export function peerAvatarUrl(address: string, displayPx: number): string {
  return stampAvatarUrl(address, displayPx, avatarCacheKey(getPeerAvatar(address)));
}

const persisted = new PersistentStore<PeerProfileEntries>('peer-profiles.json', true);
let hydration: Promise<void> | null = null;

async function hydrateAndMirror(): Promise<void> {
  const saved = await persisted.hydrate().catch(() => null);
  if (saved) seedPeerProfiles(saved);
  subscribePeerProfiles(() => { persisted.set(peerProfileEntries()); });
}

export function hydratePeerProfiles(): Promise<void> {
  hydration ??= hydrateAndMirror();
  return hydration;
}

export function usePeerProfiles(addresses: (string | null | undefined)[]): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const key = addresses.filter(Boolean).join(',');
  useEffect(() => {
    ensurePeerProfiles(addresses);
    return subscribePeerProfiles(() => { bump(); });
  }, [key]);
  return version;
}
