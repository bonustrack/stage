import type { HistoryEntry } from '@stage-labs/client/types';
import { isSystemEntry } from '@stage-labs/client/xmtp/envelope';
import {
  groupUpdateInboxIds, humanizeGroupUpdated, onlyMembersLeft, type GroupUpdatedContent, type InboxNamer,
} from '@stage-labs/client/xmtp/humanize';
import { XMTP_USER_PREFIX } from '@stage-labs/client/xmtp/line';
import { mentionToken } from '@stage-labs/client/xmtp/mentions';

function groupUpdateOf(entry: HistoryEntry): GroupUpdatedContent | null {
  const payload = entry.payload as { system?: boolean; groupUpdate?: GroupUpdatedContent } | undefined;
  return payload?.system === true && payload.groupUpdate ? payload.groupUpdate : null;
}

export function isLeftOnlyUpdate(entry: HistoryEntry): boolean {
  const update = groupUpdateOf(entry);
  return update !== null && onlyMembersLeft(update);
}

function systemLineInboxIds(entry: HistoryEntry): string[] {
  if (!isSystemEntry(entry)) return [];
  const author = entry.from.startsWith(XMTP_USER_PREFIX) ? [entry.from.slice(XMTP_USER_PREFIX.length)] : [];
  const update = groupUpdateOf(entry);
  return update ? [...author, ...groupUpdateInboxIds(update)] : author;
}

export function unknownSystemLineInboxIds(entries: readonly HistoryEntry[], known: Record<string, string>): string[] {
  const ids = new Set(entries.flatMap(systemLineInboxIds));
  return [...ids].filter(id => id !== '' && !Object.hasOwn(known, id)).sort();
}

export function withMemberNames<E extends HistoryEntry>(entry: E, nameOf: InboxNamer): E {
  const update = groupUpdateOf(entry);
  if (!update) return entry;
  const text = humanizeGroupUpdated(update, nameOf);
  return text === entry.text ? entry : { ...entry, text };
}

export function memberNamer(
  selfInboxId: string | null,
  addressOf: (inboxId: string) => string | null,
): InboxNamer {
  return (inboxId) => {
    if (inboxId === selfInboxId) return 'you';
    const address = addressOf(inboxId);
    return address ? mentionToken(address) : null;
  };
}
