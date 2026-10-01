import { SUGGESTED_CONTACTS, suggestedContacts } from '../SuggestedContacts.model';

export type NewChatPhase = 'idle' | 'creating' | 'sending';

export const RECENT_RECIPIENTS = 12;

export const NO_RECIPIENT_NOTE = 'Pick who to send it to.';

interface PeerRow {
  peerAddress?: unknown;
  lastTs?: number | null;
}

function peerOf(row: PeerRow): string | null {
  return typeof row.peerAddress === 'string' && row.peerAddress !== '' ? row.peerAddress.toLowerCase() : null;
}

export function recentPeers(rows: readonly PeerRow[], self: string | null): string[] {
  const own = self?.toLowerCase() ?? null;
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
    .flatMap((row) => {
      const peer = peerOf(row);
      if (peer === null || peer === own || seen.has(peer)) return [];
      seen.add(peer);
      return [peer];
    });
}

export function recipientCandidates(
  rows: readonly PeerRow[], self: string | null, pool: readonly string[] = SUGGESTED_CONTACTS, limit = RECENT_RECIPIENTS,
): string[] {
  const peers = recentPeers(rows, self);
  const suggested = suggestedContacts(peers, self, pool).map(address => address.toLowerCase());
  return [...peers.slice(0, limit), ...suggested];
}

export function shownRecipients(candidates: readonly string[], added: readonly string[]): string[] {
  const known = new Set(candidates.map(address => address.toLowerCase()));
  return [...added.filter(address => !known.has(address.toLowerCase())), ...candidates];
}

export function pickedRecipients(picked: readonly string[] | null, candidates: readonly string[]): string[] {
  if (picked !== null) return [...picked];
  const first = candidates[0];
  return first === undefined ? [] : [first];
}

export function chatKey(addresses: readonly string[]): string {
  return addresses.map(a => a.toLowerCase()).sort().join(',');
}

export function phaseNote(phase: NewChatPhase): string | null {
  if (phase === 'creating') return 'Creating the chat…';
  if (phase === 'sending') return 'Sending…';
  return null;
}
