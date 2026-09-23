import { asFileUri } from './localAttachmentCache';
import { File, Paths } from 'expo-file-system';
import {
  MultiRemoteAttachmentCodec,
  type MultiRemoteAttachmentContent, type RemoteAttachmentInfo,
  type RemoteAttachmentMetadata, type EncryptedLocalAttachment,
} from '@xmtp/react-native-sdk';
import { xmtpClient } from './xmtp.client';
import { convOfLine } from './xmtp.sdk';
import { type LocalAttachmentInput } from './xmtp.types';
import {
  materializeFileUri, sanitizeFileUri, uploadEncryptedToIpfs, swarmToHttp,
  type SanitizedFileUri,
} from './xmtp.swarm';
import { attachmentMimeType } from './attachmentFiles';
import { attempt } from './errorPolicy';

export { swarmToHttp } from './xmtp.swarm';
export { fileUriToBase64 } from './attachmentFiles';

interface AttachmentEncryptor {
  encryptAttachment: (file: {
    fileUri: string; mimeType?: string; filename?: string;
  }) => Promise<EncryptedLocalAttachment>;
}
export async function encryptSanitizedAttachment(
  client: AttachmentEncryptor,
  file: { fileUri: SanitizedFileUri; mimeType?: string; filename?: string },
): Promise<EncryptedLocalAttachment> {
  return await client.encryptAttachment(file);
}

export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[],
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const client = await xmtpClient();

  const infos: RemoteAttachmentInfo[] = [];
  for (const f of files) {
    const fileUri = await materializeFileUri(f.fileUri);
    const mimeType = attachmentMimeType(f.mimeType, f.filename);
    const cleanUri = await sanitizeFileUri(fileUri, mimeType, f.filename);
    const encrypted = await encryptSanitizedAttachment(client, {
      fileUri: cleanUri, mimeType, filename: f.filename,
    });
    const url = await uploadEncryptedToIpfs(encrypted.encryptedLocalFileUri, f.filename);
    infos.push(MultiRemoteAttachmentCodec.buildMultiRemoteAttachmentInfo(url, encrypted.metadata));
  }

  const payload: MultiRemoteAttachmentContent = { attachments: infos };
  return await conv.send({ multiRemoteAttachment: payload });
}

export async function resolveRemoteAttachment(info: RemoteAttachmentInfo): Promise<{
  fileUri: string; mimeType?: string; filename?: string;
}> {
  const client = await xmtpClient();
  const tmpName = `xmtp-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) attempt(() => { dest.delete(); }, 'cleanup');
  await File.downloadFileAsync(swarmToHttp(info.url), dest, { idempotent: true });
  const metadata: RemoteAttachmentMetadata = {
    secret: info.secret, salt: info.salt, nonce: info.nonce,
    contentDigest: info.contentDigest, contentLength: info.contentLength,
    filename: info.filename,
  };
  const encrypted: EncryptedLocalAttachment = {
    encryptedLocalFileUri: asFileUri(dest.uri),
    metadata,
  };
  const decrypted = await client.decryptAttachment(encrypted);
  return { fileUri: decrypted.fileUri, mimeType: decrypted.mimeType, filename: decrypted.filename };
}
