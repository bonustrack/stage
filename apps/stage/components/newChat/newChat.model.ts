import { SUGGESTED_CONTACTS, suggestedContacts } from '../contacts/SuggestedContacts.model';
import { isStringList } from '@stage-labs/client/collections';
import { reactorsLabel } from '../bubble/reactors.model';
import { PAGES, newChatHref } from '../tabs/pages';
import { CHANNEL_NAME_MAX } from '../channel/EditChannelModal.model';
import { isSyncGroupName } from '@stage-labs/client/xmtp/sync/group';
import { shortAddress } from '@stage-labs/client/identity/format';
import { mentionLabel } from '@stage-labs/client/xmtp/messageBody';
import { splitGraphemes } from 'unicode-segmenter/grapheme';
import { toDisplay, type LabelOf } from '../composer/mentions.model';

export function firstMessageChannelName(
  text: string,
  labelOf: LabelOf = (address) => mentionLabel(shortAddress(address)),
): string | undefined {
  const plain = toDisplay(text, labelOf)
    .replace(/[\s\p{Cc}]+/gu, ' ')
    .trim();
  const encoder = new TextEncoder();
  const suffix = encoder.encode(plain).length > CHANNEL_NAME_MAX ? '…' : '';
  const maxBytes = CHANNEL_NAME_MAX - encoder.encode(suffix).length;
  let name = '';
  let bytes = 0;
  for (const grapheme of splitGraphemes(plain)) {
    const size = encoder.encode(grapheme).length;
    if (bytes + size > maxBytes) break;
    name += grapheme;
    bytes += size;
  }
  name = name.trimEnd() + suffix;
  return (isSyncGroupName(name) ? `S${name.slice(1)}` : name).trim() || undefined;
}

export const MAX_SHOWN_RECIPIENTS = 5;

export const REQUEST_CHECK_LIMIT = 10;

export const NO_RECIPIENT_NOTE = 'Pick who to send it to.';

export function newChatDraftKey(account: { id: string } | null): string | null {
  return account === null ? null : `new-chat:${account.id}`;
}

export function newChatNav(wide: boolean, board: boolean, pathname: string): { href: ReturnType<typeof newChatHref>; push: boolean } {
  return { href: newChatHref(wide, board), push: !wide || (board && pathname === PAGES.board.href) };
}

export function membersDraftKey(draftKey: string | null): string | null {
  return draftKey === null ? null : `${draftKey}:members`;
}

export interface Picks {
  added: string[];
  chosen: string[] | null;
}

export const NO_PICKS: Picks = { added: [], chosen: null };

export function savedPicks(saved: unknown): Picks | null {
  if (typeof saved !== 'object' || saved === null || !('added' in saved) || !('chosen' in saved)) return null;
  const { added, chosen } = saved;
  return isStringList(added) && (chosen === null || isStringList(chosen)) ? { added, chosen } : null;
}

interface PeerRow {
  convId: string;
  peerAddress?: unknown;
  lastTs?: number | null;
}

export interface DmPeer {
  convId: string;
  peer: string;
}

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
  peers: readonly DmPeer[],
  self: string | null,
  requests: ReadonlySet<string> = new Set(),
  pool: readonly string[] = SUGGESTED_CONTACTS,
): string[] {
  const known = peers.map((p) => p.peer);
  const suggested = suggestedContacts(known, self, pool).map((address) => address.toLowerCase());
  return [...known.filter((peer) => !requests.has(peer)), ...suggested];
}

function lowerSet(list: readonly string[]): Set<string> {
  return new Set(list.map((address) => address.toLowerCase()));
}

export function shownRecipients(
  candidates: readonly string[],
  added: readonly string[],
  picked: readonly string[],
  max = MAX_SHOWN_RECIPIENTS,
): string[] {
  const known = lowerSet(candidates);
  const all = [...added.filter((address) => !known.has(address.toLowerCase())), ...candidates];
  const chosen = lowerSet(picked);
  const listed = lowerSet(all);
  const hidden = picked.filter((address) => !listed.has(address.toLowerCase()));
  return [...all.filter((address, i) => i < max || chosen.has(address.toLowerCase())), ...hidden];
}

export function pickedRecipients(
  picked: readonly string[] | null,
  candidates: readonly string[],
  remembered: readonly string[] = [],
): string[] {
  if (picked !== null) return [...picked];
  if (remembered.length > 0) return [...remembered];
  const first = candidates[0];
  return first === undefined ? [] : [first];
}

export function askPlaceholder(names: readonly string[]): string | undefined {
  return names.length === 0 ? undefined : `Ask ${reactorsLabel(names)}`;
}
