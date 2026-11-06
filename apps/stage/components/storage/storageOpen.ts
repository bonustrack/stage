import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';
import { isDeletedPlaceholderType } from '@stage-labs/client/xmtp/deleteMessage';
import { attachedFilesOf } from '@stage-labs/client/xmtp/contentTypes';
import { sdk } from '../../lib/xmtp.sdk';
import { resolveRemoteAttachment } from '../../lib/xmtp.attachments';
import { openFile } from '../../lib/fileOpen';
import type { StoredFile } from '../../lib/storageIndex.model';
import { inlineAttachmentUrl } from '../media/attachmentUri';

export class FileUnavailableError extends Error {
  constructor() {
    super('This file is no longer available.');
  }
}

async function openRemote(remote: RemoteAttachmentInfo, file: StoredFile): Promise<void> {
  const resolved = await resolveRemoteAttachment(remote);
  openFile({ url: resolved.fileUri, mime: resolved.mimeType, name: resolved.filename ?? file.name });
}

export async function openStoredFile(file: StoredFile): Promise<void> {
  const client = await sdk.client();
  const message = await sdk.messageById(client, file.messageId);
  if (!message) throw new FileUnavailableError();
  const row = sdk.rowOf(message);
  if (isDeletedPlaceholderType(row.contentTypeId)) throw new FileUnavailableError();
  const att = attachedFilesOf(row.contentTypeId, row.content)[file.index];
  if (att?.remote) {
    await openRemote(att.remote as RemoteAttachmentInfo, file);
    return;
  }
  if (att?.dataB64 === undefined) throw new FileUnavailableError();
  openFile({
    url: inlineAttachmentUrl({ kind: 'file', dataB64: att.dataB64, mime: att.mime }),
    mime: att.mime,
    name: att.name ?? file.name,
  });
}
