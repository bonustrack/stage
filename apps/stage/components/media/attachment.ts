import type { HistoryEntry } from '@stage-labs/client/types';
import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';
import { attachmentsOf as entryAttachmentsOf, type EntryAttachment } from '@stage-labs/client/xmtp/entryPayload';

export type ChatAttachment = Omit<EntryAttachment, 'remote'> & { remote?: RemoteAttachmentInfo };

export function attachmentsOf(entry: HistoryEntry): ChatAttachment[] {
  return entryAttachmentsOf(entry) as ChatAttachment[];
}

export function isSvgAttachment(att: { mime?: string; name?: string }): boolean {
  return /^image\/svg/i.test(att.mime?.trim() ?? '') || /\.svgz?$/i.test(att.name?.trim() ?? '');
}

export function attachmentKind(att: { kind: string; mime?: string; name?: string }): string {
  if (isSvgAttachment(att)) return 'file';
  if (att.mime?.startsWith('image/')) return 'image';
  if (att.mime?.startsWith('audio/')) return 'audio';
  if (att.mime?.startsWith('video/')) return 'video';
  return att.kind;
}

export interface AttachmentSource {
  uri: string | null;
  mime: string | undefined;
  failed: boolean;
}

type LocalCopy = { uri: string; mime?: string } | undefined;

function inlineSource(att: { mime?: string }, inlineUri: string, local: LocalCopy): AttachmentSource {
  return { uri: local?.uri ?? inlineUri, mime: local?.mime ?? att.mime, failed: false };
}

export function attachmentSource(
  att: { mime?: string; remote?: unknown },
  inlineUri: string,
  local: LocalCopy,
  remote: { uri: string | null; mime?: string; isError: boolean },
): AttachmentSource {
  if (att.remote === undefined) return inlineSource(att, inlineUri, local);
  return { uri: local?.uri ?? remote.uri, mime: remote.mime ?? local?.mime ?? att.mime, failed: remote.isError && !local };
}
