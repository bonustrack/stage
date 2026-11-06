import { isSyncGroupName, type GroupKey } from '@stage-labs/client/xmtp/readState';
import { channelDraftProblem } from '../channel/EditChannelModal.model';
import { groupedChatMetadata, newChatAppData } from '../home/newChatMetadata.model';

export function boardChannelNameProblem(name: string): string | null {
  if (name.trim() === '') return 'Enter a channel name.';
  if (isSyncGroupName(name.trim())) return 'Choose another channel name.';
  return channelDraftProblem({ name: null, description: '' }, { name, description: '' });
}

export function boardChannelDraft(by: GroupKey, key: string, title: string, name: string, self: string) {
  const metadata = groupedChatMetadata(by, key, title);
  return { name: name.trim(), members: metadata.assigned.length > 0 ? metadata.assigned : [self], appData: newChatAppData(metadata) };
}
