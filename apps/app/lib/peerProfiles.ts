/** Peer Snapshot-profile cache. The framework-agnostic core (the batched store,
 *  fetch, and accessors) moved into the Stage SDK (@metro-labs/client); this
 *  module re-exports it and keeps only the React `usePeerProfiles` hook, which
 *  subscribes via the SDK's subscribePeerProfiles + bumps a version counter so
 *  rows re-render (usable as FlatList `extraData`). */

import { useEffect, useReducer } from 'react';
import {
  ensurePeerProfiles,
  subscribePeerProfiles,
} from '@metro-labs/client/identity/peerProfiles';

export {
  setPeerProfile,
  ensurePeerProfiles,
  isPeerResolved,
  getPeerName,
  getPeerAbout,
  getPeerAvatarCb,
  getPeerAvatar,
  type PeerProfile,
} from '@metro-labs/client/identity/peerProfiles';

/** Subscribe + fetch: re-renders the caller when the batch resolves. Returns a
 *  version counter usable as FlatList `extraData` so rows re-render too. */
export function usePeerProfiles(addresses: (string | null | undefined)[]): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const key = addresses.filter(Boolean).join(',');
  useEffect(() => {
    ensurePeerProfiles(addresses);
    return subscribePeerProfiles(() => bump());
  }, [key]);
  return version;
}
