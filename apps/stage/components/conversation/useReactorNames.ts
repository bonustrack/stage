import { useMemo } from 'react';
import { getPeerName } from '../../lib/peerProfiles';
import { useReconciledMap } from '../../lib/mapReconcile';
import { reactorNamer, reactorNamesByMessage } from './reactors.model';

export function useReactorNames(
  reactions: Map<string, Map<string, string[]>>,
  myUri: string,
  addressOf: (uri: string) => string | null,
  profilesVersion: number,
): Map<string, Map<string, string[]>> {
  const named = useMemo(
    () => reactorNamesByMessage(reactions, myUri, reactorNamer(addressOf, getPeerName)),
    [reactions, myUri, addressOf, profilesVersion],
  );
  return useReconciledMap(named);
}
