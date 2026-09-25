import type { HistoryEntry } from '@stage-labs/client/types';
import { humanizeGroupUpdated, type GroupUpdatedContent, type InboxNamer } from '@stage-labs/client/xmtp/humanize';
import { mentionToken } from '@stage-labs/client/xmtp/mentions';

function groupUpdateOf(entry: HistoryEntry): GroupUpdatedContent | null {
  const payload = entry.payload as { system?: boolean; groupUpdate?: GroupUpdatedContent } | undefined;
  return payload?.system === true && payload.groupUpdate ? payload.groupUpdate : null;
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
