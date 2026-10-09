import type { RemoteAttachmentInfo } from '@xmtp/react-native-sdk';
import { isDeletedPlaceholderType, shortTypeId } from '@stage-labs/client/xmtp/deleteMessage';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import { sdk } from '../../lib/xmtp.sdk';
import { resolveRemoteAttachment } from '../../lib/xmtp.attachments';
import { openFile } from '../../lib/fileOpen';
import type { StoredFile } from '../../lib/storageIndex.model';
import { attachmentsOf } from '../bubble/helpers';
import { inlineAttachmentUrl } from '../bubble/attachmentUri';

export class FileUnavailableError extends Error {
  constructor() { super('This file is no longer available.'); }
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
  if (shortTypeId(row.contentTypeId) === 'remoteStaticAttachment' && file.index === 0) {
    await openRemote(row.content as RemoteAttachmentInfo, file);
    return;
  }
  const att = attachmentsOf(sdk.envelopeOf(message, lineOfConv(file.convId)))[file.index];
  if (att?.remote) {
    await openRemote(att.remote, file);
    return;
  }
  if (att?.dataB64 === undefined) throw new FileUnavailableError();
  openFile({ url: inlineAttachmentUrl(att), mime: att.mime, name: att.name ?? file.name });
}
