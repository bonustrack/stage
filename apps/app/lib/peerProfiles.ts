/** @file React `usePeerProfiles` hook re-exporting the Stage SDK peer-profile cache and bumping a version counter (FlatList `extraData`) when a batch resolves. */

/** Peer profile cache core lives in the Stage SDK; this module re-exports it and keeps only the React usePeerProfiles hook that subscribes and bumps a version counter for row re-renders. */

import { useEffect, useReducer } from 'react';
import {
  ensurePeerProfiles,
  subscribePeerProfiles,
} from '@stage-labs/client/identity/peerProfiles';

export {
  isPeerResolved,
  getPeerName,
} from '@stage-labs/client/identity/peerProfiles';

/** Subscribe + fetch: re-renders the caller when the batch resolves. Returns a version counter usable as FlatList `extraData` so rows re-render too. */
export function usePeerProfiles(addresses: (string | null | undefined)[]): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const key = addresses.filter(Boolean).join(',');
  useEffect(() => {
    ensurePeerProfiles(addresses);
    return subscribePeerProfiles(() => { bump(); });
  }, [key]);
  return version;
}
