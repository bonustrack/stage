import { resolveRemoteAttachment } from '../../lib/xmtp.attachmentSdk';
import { openFile } from '../../lib/fileOpen';
import { storedFilePart } from '../../lib/storageIndex';
import type { StoredFile } from '../../lib/storageIndex.model';
import { inlineAttachmentUrl } from '../media/attachmentUri';

export async function openStoredFile(file: StoredFile): Promise<void> {
  const part = await storedFilePart(file);
  if (part.remote) {
    const resolved = await resolveRemoteAttachment(part.remote);
    openFile({ url: resolved.fileUri, mime: resolved.mimeType, name: resolved.filename ?? file.name });
    return;
  }
  openFile({
    url: inlineAttachmentUrl({ kind: 'file', dataB64: part.dataB64, mime: part.mime }),
    mime: part.mime,
    name: part.name ?? file.name,
  });
}
