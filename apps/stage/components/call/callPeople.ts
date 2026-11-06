import { cachedSelfEthAddress } from '../../lib/xmtp.client';
import { homeRowOf } from '../../lib/messaging/homeRows';
import { isUnnamedChannelRow } from '@stage-labs/client/xmtp/summarizeRow';
import { type ConvTitle } from '../TitleText.model';
import { peerLabel } from '../../lib/peerProfiles';

interface CallPerson {
  address: string | null;
  name: string;
}

function nameOf(address: string | null): string {
  return address ? peerLabel(address) : 'Someone';
}

export function callPerson(convId: string, inboxId: string, selfInboxId: string | null): CallPerson {
  if (inboxId === selfInboxId) return { address: cachedSelfEthAddress() ?? null, name: 'You' };
  const row = homeRowOf(convId);
  const address = row?.inboxToAddr[inboxId] ?? row?.peerAddress ?? null;
  return { address, name: nameOf(address) };
}

export function callTitle(convId: string): ConvTitle {
  const row = homeRowOf(convId);
  if (!row) return { text: 'Call', placeholder: false };
  if (row.peerAddress) return { text: nameOf(row.peerAddress), placeholder: false };
  return { text: row.title, placeholder: isUnnamedChannelRow(row) };
}
