import type { PeerProfileEntries } from '@stage-labs/client/identity/peerProfiles';
import { PersistentStore } from './cache.shared';
import { storedRecordOf, valueWith } from './storeCore';
import { recover } from './errorPolicy';
import { peerProfileEntries, seedPeerProfiles, subscribePeerProfiles } from './peerProfiles';

const isPeerProfileEntry = (value: unknown): value is PeerProfileEntries[string] =>
  value === null || typeof value === 'string' || (typeof value === 'object' && !Array.isArray(value));

const persisted = new PersistentStore<PeerProfileEntries>('peer-profiles.json', { parse: valueWith(storedRecordOf(isPeerProfileEntry)) });
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
