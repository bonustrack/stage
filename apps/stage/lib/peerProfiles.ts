import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  ensurePeerProfiles,
  getPeerAvatar,
  peerProfileEntries,
  peerProfilesRevision,
  seedPeerProfiles,
  setOnchainProfileResolver,
  subscribePeerProfiles,
  type PeerProfileEntries,
} from '@stage-labs/client/identity/peerProfiles';
import { avatarCacheKey, baseProfileClient, resolveOnchainProfile } from '@stage-labs/client/identity/onchainProfile';
import { fetchIssuedName } from '@stage-labs/client/identity/stageNames';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { PersistentStore } from './cache.shared';
import { linkProxyBase } from './linkProxy';
import { recover } from './errorPolicy';

export {
  isPeerResolved,
  getPeerName,
  getPeerDisplayName,
  getPeerHandle,
  peerLabel,
  getPeerDescription,
  getPeerAvatar,
  getPeerProfileSource,
  invalidatePeerProfile,
} from '@stage-labs/client/identity/peerProfiles';

export function installPeerProfileResolver(): void {
  setOnchainProfileResolver((address) =>
    resolveOnchainProfile(baseProfileClient(), address, (peer) => fetchIssuedName(linkProxyBase(), peer)),
  );
}

export function peerAvatarUrl(address: string, displayPx: number): string {
  return stampAvatarUrl(address, displayPx, avatarCacheKey(getPeerAvatar(address)));
}

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

export function usePeerProfiles(addresses: (string | null | undefined)[]): number {
  const key = addresses.filter(Boolean).join(',');
  const watched = useMemo(() => (key === '' ? [] : key.split(',')), [key]);
  useEffect(() => {
    ensurePeerProfiles(watched);
  }, [watched]);
  const revision = useCallback(() => peerProfilesRevision(watched), [watched]);
  return useSyncExternalStore(subscribePeerProfiles, revision, revision);
}
