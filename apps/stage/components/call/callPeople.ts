import { cachedSelfEthAddress } from '../../lib/xmtp.client';
import { homeRowOf } from '../../lib/messaging/homeRows';
import { rowTitle, type ConvTitle } from '../../lib/convIdentity';
import { peerLabel } from '../../lib/peerProfiles';

interface CallPerson {
  address: string | null;
  name: string;
}

export function callPerson(convId: string, inboxId: string, selfInboxId: string | null): CallPerson {
  if (inboxId === selfInboxId) return { address: cachedSelfEthAddress() ?? null, name: 'You' };
  const row = homeRowOf(convId);
  const address = row?.inboxToAddr[inboxId] ?? row?.peerAddress ?? null;
  return { address, name: address ? peerLabel(address) : 'Someone' };
}

export function callTitle(convId: string): ConvTitle {
  const row = homeRowOf(convId);
  return row ? rowTitle(row) : { text: 'Call', placeholder: false };
}
