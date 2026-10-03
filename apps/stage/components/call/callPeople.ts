import { cachedSelfEthAddress } from '../../lib/xmtp.client';
import { homeRows } from '../home/state';
import { isUnnamedChannelRow } from '@stage-labs/client/xmtp/summarizeRow';
import { peerLabel, type ConvTitle } from '../conversation/convTitle';

interface CallPerson { address: string | null; name: string }

function nameOf(address: string | null): string {
  return address ? peerLabel(address) : 'Someone';
}

export function callPerson(convId: string, inboxId: string, selfInboxId: string | null): CallPerson {
  if (inboxId === selfInboxId) return { address: cachedSelfEthAddress() ?? null, name: 'You' };
  const row = homeRows()?.find((r) => r.convId === convId);
  const address = row?.inboxToAddr[inboxId] ?? row?.peerAddress ?? null;
  return { address, name: nameOf(address) };
}

export function callTitle(convId: string): ConvTitle {
  const row = homeRows()?.find((r) => r.convId === convId);
  if (!row) return { text: 'Call', placeholder: false };
  if (row.peerAddress) return { text: nameOf(row.peerAddress), placeholder: false };
  return { text: row.title, placeholder: isUnnamedChannelRow(row) };
}
