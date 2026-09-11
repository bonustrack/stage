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
import { makeProfileClients, resolveOnchainProfile } from '@stage-labs/client/identity/onchainProfile';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { broviderRpc } from '@stage-labs/client/wallet/client';
import { PersistentStore } from './cache';

export {
  isPeerResolved,
  getPeerName,
  getPeerAvatar,
} from '@stage-labs/client/identity/peerProfiles';

const profileClients = makeProfileClients(broviderRpc);
setOnchainProfileResolver((address) => resolveOnchainProfile(profileClients, address));

export function peerAvatarUrl(address: string, size: number): string {
  return avatarRenderUrl(address, getPeerAvatar(address), size);
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
