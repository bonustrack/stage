import { cachedSelfEthAddress, shortAddress } from '../../modules/messaging';
import { getPeerName } from '../../lib/peerProfiles';
import { homeRows } from '../home/state';

interface CallPerson { address: string | null; name: string }

function nameOf(address: string | null): string {
  return address ? getPeerName(address) ?? shortAddress(address) : 'Someone';
}

export function callPerson(convId: string, inboxId: string, selfInboxId: string | null): CallPerson {
  if (inboxId === selfInboxId) return { address: cachedSelfEthAddress() ?? null, name: 'You' };
  const row = homeRows()?.find((r) => r.convId === convId);
  const address = row?.inboxToAddr[inboxId] ?? row?.peerAddress ?? null;
  return { address, name: nameOf(address) };
}

export function callTitle(convId: string): string {
  const row = homeRows()?.find((r) => r.convId === convId);
  if (!row) return 'Call';
  return row.peerAddress ? nameOf(row.peerAddress) : row.title;
}
