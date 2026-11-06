import type { PeerProfileEntries } from '@stage-labs/client/identity/peerProfiles';
import { PersistentStore } from './cache.shared';
import { recover } from './errorPolicy';
import { peerProfileEntries, seedPeerProfiles, subscribePeerProfiles } from './peerProfiles';

const persisted = new PersistentStore<PeerProfileEntries>('peer-profiles.json');
let hydration: Promise<void> | null = null;

async function hydrateAndMirror(): Promise<void> {
  const saved = await persisted.hydrate().catch(recover('peerProfiles.hydrate', null));
  if (saved) seedPeerProfiles(saved);
  subscribePeerProfiles(() => {
    persisted.set(peerProfileEntries());
  });
}

export function hydratePeerProfiles(): Promise<void> {
  hydration ??= hydrateAndMirror();
  return hydration;
}
