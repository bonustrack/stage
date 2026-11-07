import { useMemo } from 'react';
import { useConvRow } from './messaging/queries';
import { usePeerProfiles } from './peerProfiles';

export function useStoredChat(convId: string, recheckMs?: number): { peerAddress: string | null; groupName: string } | null {
  const row = useConvRow(convId, recheckMs);
  const known = row !== null;
  const peerAddress = row?.peerAddress ?? null;
  const groupName = row?.groupName ?? '';
  usePeerProfiles([peerAddress]);
  return useMemo(() => (known ? { peerAddress, groupName } : null), [known, peerAddress, groupName]);
}
