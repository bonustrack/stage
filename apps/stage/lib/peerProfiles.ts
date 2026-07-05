

import { useEffect, useReducer } from 'react';
import {
  ensurePeerProfiles,
  subscribePeerProfiles,
} from '@stage-labs/client/identity/peerProfiles';

export {
  isPeerResolved,
  getPeerName,
} from '@stage-labs/client/identity/peerProfiles';

export function usePeerProfiles(addresses: (string | null | undefined)[]): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const key = addresses.filter(Boolean).join(',');
  useEffect(() => {
    ensurePeerProfiles(addresses);
    return subscribePeerProfiles(() => { bump(); });
  }, [key]);
  return version;
}
