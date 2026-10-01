import { asFileUri } from './localAttachmentCache';
import { File, Paths } from 'expo-file-system';
import {
  MultiRemoteAttachmentCodec,
  type MultiRemoteAttachmentContent, type RemoteAttachmentInfo,
  type RemoteAttachmentMetadata, type EncryptedLocalAttachment,
} from '@xmtp/react-native-sdk';
import { xmtpClient } from './xmtp.client';
import { sendableConvOfLine } from './xmtp.sdk';
import { withReadableSendError } from './xmtp.sdk.core';
import { type LocalAttachmentInput } from './xmtp.types';
import {
  materializeFileUri, sanitizeFileUri, uploadEncryptedToIpfs, swarmToHttp,
  type SanitizedFileUri,
} from './xmtp.swarm';
import { attachmentMimeType } from './attachmentFiles';
import { makeAttachmentPrep } from './xmtp.attachmentPrep.core';
import { attempt } from './errorPolicy';

export { swarmToHttp } from './xmtp.swarm';

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

async function encryptedFileOf(f: LocalAttachmentInput): Promise<EncryptedLocalAttachment> {
  const client = await xmtpClient();
  const fileUri = await materializeFileUri(f.fileUri);
  const mimeType = attachmentMimeType(f.mimeType, f.filename);
  const cleanUri = await sanitizeFileUri(fileUri, mimeType, f.filename);
  return await encryptSanitizedAttachment(client, { fileUri: cleanUri, mimeType, filename: f.filename });
}

async function storedRemoteAttachment(encrypted: EncryptedLocalAttachment, f: LocalAttachmentInput): Promise<RemoteAttachmentInfo> {
  const url = await uploadEncryptedToIpfs(encrypted.encryptedLocalFileUri, f.filename);
  return MultiRemoteAttachmentCodec.buildMultiRemoteAttachmentInfo(url, { ...encrypted.metadata, filename: f.filename });
}

const prep = makeAttachmentPrep(encryptedFileOf, storedRemoteAttachment);

export const { prepare: prepareAttachments, upload: uploadAttachments, forget: forgetAttachments } = prep;

export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[],
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const [conv, infos] = await Promise.all([withReadableSendError(() => sendableConvOfLine(line)), prep.uploaded(files)]);
  const payload: MultiRemoteAttachmentContent = { attachments: infos };
  const id = await withReadableSendError(() => conv.send({ multiRemoteAttachment: payload }));
  prep.forget(files);
  return id;
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
