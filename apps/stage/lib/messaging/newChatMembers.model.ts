import { isStringList, uniqueKeys } from '@stage-labs/client/collections';
import { z } from 'zod';
import { storedRecordOf } from '../storeCore';

const MEMBER_RE = /^0x[0-9a-f]{40}$/;

export interface MemberStat {
  count: number;
  at: number;
}

export interface MemberHistory {
  last: string[];
  stats: Record<string, MemberStat>;
}

export const NO_MEMBER_HISTORY: MemberHistory = { last: [], stats: {} };

function validMembers(list: readonly string[], self: string | null): string[] {
  const own = self?.toLowerCase() ?? null;
  return [...new Set(list.map((address) => address.toLowerCase()).filter((address) => MEMBER_RE.test(address) && address !== own))];
}

function isMemberStat(value: unknown): value is MemberStat {
  return (
    typeof value === 'object' &&
    value !== null &&
    'count' in value &&
    'at' in value &&
    typeof value.count === 'number' &&
    typeof value.at === 'number'
  );
}

export const memberHistorySchema = z.object({ last: z.array(z.string()), stats: storedRecordOf(isMemberStat) });

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
  return ranked.sort((a, b) => b.count - a.count || b.at - a.at || a.index - b.index).map((entry) => entry.address);
}
