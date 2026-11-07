import type { HistoryEntry } from '@stage-labs/client/types';
import { groupUpdateOf, isSystemEntry } from '@stage-labs/client/xmtp/entryPayload';
import { groupUpdateInboxIds, humanizeGroupUpdated, type InboxNamer } from '@stage-labs/client/xmtp/humanize';
import { inboxIdOfUri } from '@stage-labs/client/xmtp/line';
import { mentionToken } from '@stage-labs/client/xmtp/mentions';

function systemLineInboxIds(entry: HistoryEntry): string[] {
  if (!isSystemEntry(entry)) return [];
  const author = [inboxIdOfUri(entry.from)];
  const update = groupUpdateOf(entry);
  return update ? [...author, ...groupUpdateInboxIds(update)] : author;
}

export function unknownSystemLineInboxIds(entries: readonly HistoryEntry[], known: Record<string, string>): string[] {
  const ids = new Set(entries.flatMap(systemLineInboxIds));
  return [...ids].filter((id) => id !== '' && !Object.hasOwn(known, id)).sort();
}

export function withMemberNames<E extends HistoryEntry>(entry: E, nameOf: InboxNamer): E {
  const update = groupUpdateOf(entry);
  if (!update) return entry;
  const text = humanizeGroupUpdated(update, nameOf);
  return text === entry.text ? entry : { ...entry, text };
}

export function memberNamer(selfInboxId: string | null, addressOf: (inboxId: string) => string | null): InboxNamer {
  return (inboxId) => {
    if (inboxId === selfInboxId) return 'you';
    const address = addressOf(inboxId);
    return address ? mentionToken(address) : null;
  };
}
