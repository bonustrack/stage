import { isSyncGroupName, type GroupKey } from '@stage-labs/client/xmtp/readState';
import { channelDraftProblem } from '../channel/EditChannelModal.model';
import { groupedChatMetadata, newChatAppData, type NewChatMetadata } from '../home/newChatMetadata.model';

export interface BoardPendingChannel {
  name: string;
  appData: string | undefined;
  existingIds: ReadonlySet<string>;
  convId: string | null;
}

interface PendingRow extends NewChatMetadata {
  convId: string;
  groupName?: string;
  peerAddress: string | null;
  priority: string | null;
}

export function boardChannelRows<T extends PendingRow>(rows: T[], pending: BoardPendingChannel | null): T[] {
  if (pending === null) return rows;
  return rows.filter((row) => {
    if (pending.convId !== null) return row.convId !== pending.convId;
    return (
      pending.existingIds.has(row.convId) ||
      row.peerAddress !== null ||
      row.groupName !== pending.name ||
      row.priority !== null ||
      newChatAppData(row) !== pending.appData
    );
  });
}

export function boardChannelNameProblem(name: string): string | null {
  if (name.trim() === '') return 'Enter a channel name.';
  if (isSyncGroupName(name.trim())) return 'Choose another channel name.';
  return channelDraftProblem({ name: null, description: '' }, { name, description: '' });
}

export function boardChannelDraft(by: GroupKey, key: string, title: string, name: string, self: string) {
  const metadata = groupedChatMetadata(by, key, title);
  return { name: name.trim(), members: metadata.assigned.length > 0 ? metadata.assigned : [self], appData: newChatAppData(metadata) };
}
