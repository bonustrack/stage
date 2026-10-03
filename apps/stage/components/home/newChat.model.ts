import { SUGGESTED_CONTACTS, suggestedContacts } from '../SuggestedContacts.model';
import { reactorsLabel } from '../conversation/reactors.model';
import { uniqueKeys } from '../conversation/SidebarSection.model';

export const MAX_SHOWN_RECIPIENTS = 5;

export const REQUEST_CHECK_LIMIT = 10;

export const NO_RECIPIENT_NOTE = 'Pick who to send it to.';

export function newChatDraftKey(account: { id: string } | null): string | null {
  return account === null ? null : `new-chat:${account.id}`;
}

interface NewChatNav { href: '/' | '/new'; push: boolean }

export function newChatNav(wide: boolean, board: boolean, pathname: string): NewChatNav {
  if (!wide) return { href: '/new', push: true };
  if (!board) return { href: '/', push: false };
  return { href: '/new', push: pathname === '/' };
}

export function membersDraftKey(draftKey: string | null): string | null {
  return draftKey === null ? null : `${draftKey}:members`;
}

export interface Picks { added: string[]; chosen: string[] | null }

export const NO_PICKS: Picks = { added: [], chosen: null };

function isAddresses(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(a => typeof a === 'string');
}

export function savedPicks(saved: unknown): Picks | null {
  if (typeof saved !== 'object' || saved === null || !('added' in saved) || !('chosen' in saved)) return null;
  const { added, chosen } = saved;
  return isAddresses(added) && (chosen === null || isAddresses(chosen)) ? { added, chosen } : null;
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

export function pickedRecipients(
  picked: readonly string[] | null, candidates: readonly string[], remembered: readonly string[] = [],
): string[] {
  if (picked !== null) return [...picked];
  if (remembered.length > 0) return [...remembered];
  const first = candidates[0];
  return first === undefined ? [] : [first];
}

const MEMBER_RE = /^0x[0-9a-f]{40}$/;

export interface MemberStat { count: number; at: number }

export interface MemberHistory { last: string[]; stats: Record<string, MemberStat> }

export const NO_MEMBER_HISTORY: MemberHistory = { last: [], stats: {} };

function validMembers(list: readonly string[], self: string | null): string[] {
  const own = self?.toLowerCase() ?? null;
  return [...new Set(list.map(address => address.toLowerCase()).filter(address => MEMBER_RE.test(address) && address !== own))];
}

function isMemberStat(value: unknown): value is MemberStat {
  return typeof value === 'object' && value !== null && 'count' in value && 'at' in value
    && typeof value.count === 'number' && typeof value.at === 'number';
}

function memberHistoryOf(parsed: unknown): MemberHistory {
  if (typeof parsed !== 'object' || parsed === null || !('last' in parsed) || !('stats' in parsed)) return NO_MEMBER_HISTORY;
  const { last, stats } = parsed;
  if (!isAddresses(last) || typeof stats !== 'object' || stats === null) return NO_MEMBER_HISTORY;
  return { last, stats: Object.fromEntries(Object.entries(stats).filter((e): e is [string, MemberStat] => isMemberStat(e[1]))) };
}

export function parseMemberHistory(raw: string): MemberHistory {
  try { return memberHistoryOf(JSON.parse(raw)); } catch { return NO_MEMBER_HISTORY; }
}

export function startedChatWith(history: MemberHistory, members: readonly string[], at: number): MemberHistory {
  const last = validMembers(members, null);
  if (last.length === 0) return history;
  const stats = { ...history.stats };
  for (const member of last) stats[member] = { count: (stats[member]?.count ?? 0) + 1, at };
  return { last, stats };
}

export function rememberedMembers(history: MemberHistory, self: string | null): string[] {
  return validMembers(history.last, self);
}

export function rankedCandidates(candidates: readonly string[], history: MemberHistory, self: string | null): string[] {
  const pool = uniqueKeys([...candidates, ...validMembers(Object.keys(history.stats), self)]);
  const ranked = pool.map((address, index) => {
    const stat = history.stats[address.toLowerCase()];
    return { address, index, count: stat?.count ?? 0, at: stat?.at ?? 0 };
  });
  return ranked.sort((a, b) => b.count - a.count || b.at - a.at || a.index - b.index).map(entry => entry.address);
}

export function askPlaceholder(names: readonly string[]): string | undefined {
  return names.length === 0 ? undefined : `Ask ${reactorsLabel(names)}`;
}
