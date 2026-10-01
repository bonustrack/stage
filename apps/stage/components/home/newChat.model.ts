import { SUGGESTED_CONTACTS, suggestedContacts } from '../SuggestedContacts.model';

export const MAX_SHOWN_RECIPIENTS = 5;

export const REQUEST_CHECK_LIMIT = 10;

export const NO_RECIPIENT_NOTE = 'Pick who to send it to.';

export function newChatDraftKey(account: { id: string } | null): string | null {
  return account === null ? null : `new-chat:${account.id}`;
}

interface PeerRow {
  convId: string;
  peerAddress?: unknown;
  lastTs?: number | null;
}

export interface DmPeer { convId: string; peer: string }

function peerOf(row: PeerRow): string | null {
  return typeof row.peerAddress === 'string' && row.peerAddress !== '' ? row.peerAddress.toLowerCase() : null;
}

export function recentDmPeers(rows: readonly PeerRow[], self: string | null): DmPeer[] {
  const own = self?.toLowerCase() ?? null;
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
    .flatMap((row) => {
      const peer = peerOf(row);
      if (peer === null || peer === own || seen.has(peer)) return [];
      seen.add(peer);
      return [{ convId: row.convId, peer }];
    });
}

export function recipientCandidates(
  peers: readonly DmPeer[], self: string | null, requests: ReadonlySet<string> = new Set(), pool: readonly string[] = SUGGESTED_CONTACTS,
): string[] {
  const accepted = peers.map(p => p.peer).filter(peer => !requests.has(peer));
  const suggested = suggestedContacts(peers.map(p => p.peer), self, pool).map(address => address.toLowerCase());
  return [...accepted, ...suggested];
}

function lowerSet(list: readonly string[]): Set<string> {
  return new Set(list.map(address => address.toLowerCase()));
}

export function shownRecipients(
  candidates: readonly string[], added: readonly string[], picked: readonly string[], max = MAX_SHOWN_RECIPIENTS,
): string[] {
  const known = lowerSet(candidates);
  const all = [...added.filter(address => !known.has(address.toLowerCase())), ...candidates];
  const chosen = lowerSet(picked);
  const listed = lowerSet(all);
  const hidden = picked.filter(address => !listed.has(address.toLowerCase()));
  return [...all.filter((address, i) => i < max || chosen.has(address.toLowerCase())), ...hidden];
}

export function pickedRecipients(picked: readonly string[] | null, candidates: readonly string[]): string[] {
  if (picked !== null) return [...picked];
  const first = candidates[0];
  return first === undefined ? [] : [first];
}
