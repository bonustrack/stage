import type { HistoryEntry } from '@stage-labs/client/types';
import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';
import { attachmentsOf as entryAttachmentsOf, type EntryAttachment } from '@stage-labs/client/xmtp/entryPayload';

export type ChatAttachment = Omit<EntryAttachment, 'remote'> & { remote?: RemoteAttachmentInfo };

export function attachmentsOf(entry: HistoryEntry): ChatAttachment[] {
  return entryAttachmentsOf(entry) as ChatAttachment[];
}
