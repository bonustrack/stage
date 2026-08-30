import { useEffect, useReducer } from 'react';
import {
  ensurePeerProfiles,
  peerProfileEntries,
  seedPeerProfiles,
  subscribePeerProfiles,
  type PeerProfileEntries,
} from '@stage-labs/client/identity/peerProfiles';
import { PersistentStore } from './cache';

export {
  isPeerResolved,
  getPeerName,
} from '@stage-labs/client/identity/peerProfiles';

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
