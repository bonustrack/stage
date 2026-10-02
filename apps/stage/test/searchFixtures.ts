import { memberNames, type FilterRow } from '../components/searchFilter.model';

export const SELF = '0xself';
export const ALICE = '0xa11ce00000000000000000000000000000000001';
export const BOB = '0xb0b0000000000000000000000000000000000002';

export function group(convId: string, labels: string[], members: string[] = []): FilterRow {
  const inboxToAddr = Object.fromEntries([['self', SELF], ...members.map((address, i) => [`inbox-${i}`, address])]);
  return { convId, title: convId, lastPreview: '', lastTs: 1, unreadCount: 0, labels, inboxToAddr, selfInboxId: 'self' };
}

export const NAMES: Record<string, string[]> = {
  [ALICE]: memberNames('alice123.stage.base.eth', 'Alice Doe'),
  [BOB]: memberNames('bob.base.eth', undefined),
};
