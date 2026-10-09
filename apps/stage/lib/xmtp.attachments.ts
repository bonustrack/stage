import { asFileUri } from './localAttachmentCache';
import { File, Paths } from 'expo-file-system';
import { stripMetadataBytes, isStrippableImage } from '@stage-labs/client/image/stripMetadata';
import {
  MultiRemoteAttachmentCodec,
  type RemoteAttachmentInfo,
  type RemoteAttachmentMetadata, type EncryptedLocalAttachment,
} from '@xmtp/react-native-sdk';
import { xmtpClient } from './xmtp.client';
import { sendableConvOfLine } from './xmtp.sdk';
import { withReadableSendError } from './xmtp.sdk.core';
import type { LocalAttachmentInput, OnAttachmentsUploaded } from './xmtp.types';
import { attachmentDownloadUrl, uploadEncryptedAttachment } from './attachmentStorage';
import { attachmentMimeType } from './attachmentFiles';
import { makeAttachmentPrep, sendPreparedAttachment } from './xmtp.attachmentPrep.core';
import { accountClient } from './xmtp.account';
import { attempt } from './errorPolicy';

declare const sanitizedBrand: unique symbol;
export type SanitizedFileUri = string & { readonly [sanitizedBrand]: true };

async function materializeFileUri(src: string): Promise<string> {
  if (src.startsWith('file://')) return src;
  if (src.startsWith('/')) return `file://${src}`;
  const ext = src.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
  const dest = freshCacheFile('xmtp-send', ext.length <= 5 ? ext : 'bin');
  const blob = await (await fetch(src)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  dest.create();
  dest.write(buf);
  return asFileUri(dest.uri);
}

function freshCacheFile(prefix: string, ext: string): File {
  const tmpName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) attempt(() => { dest.delete(); }, 'cleanup');
  return dest;
}

export async function sanitizeFileUri(
  uri: string, mimeType: string | undefined, filename: string | undefined,
): Promise<SanitizedFileUri> {
  if (!isStrippableImage(mimeType, filename)) return uri as SanitizedFileUri;
  try {
    const blob = await (await fetch(uri)).blob();
    const input = new Uint8Array(await blob.arrayBuffer());
    const { bytes, stripped } = stripMetadataBytes(input);
    if (!stripped || bytes.length === input.length && bytes.every((v, k) => v === input[k])) {
      return uri as SanitizedFileUri;
    }
    return writeCleanImage(bytes, filename, uri);
  } catch {
    return uri as SanitizedFileUri;
  }
}

function writeCleanImage(
  bytes: Uint8Array, filename: string | undefined, uri: string,
): SanitizedFileUri {
  const ext = (filename ?? uri).split('?')[0]?.split('.').pop()?.toLowerCase() ?? 'img';
  const dest = freshCacheFile('xmtp-clean', ext.length <= 5 ? ext : 'img');
  dest.create();
  dest.write(bytes);
  return asFileUri(dest.uri) as SanitizedFileUri;
}

async function uploadEncrypted(encryptedFileUri: string, filename: string): Promise<string> {
  const response = await fetch(encryptedFileUri);
  if (!response.ok) {
    throw new Error(`Couldn't send "${filename}": the encrypted file could not be read. Try attaching it again.`);
  }
  const blob = await response.blob();
  return await uploadEncryptedAttachment(blob.slice(0, blob.size, 'application/octet-stream'), filename);
}

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
  const url = await uploadEncrypted(encrypted.encryptedLocalFileUri, f.filename);
  return MultiRemoteAttachmentCodec.buildMultiRemoteAttachmentInfo(url, { ...encrypted.metadata, filename: f.filename });
}

const prep = makeAttachmentPrep(encryptedFileOf, storedRemoteAttachment);

export const { prepare: prepareAttachments, upload: uploadAttachments, forget: forgetAttachments } = prep;

export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[], onUploaded?: OnAttachmentsUploaded,
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const session = await accountClient();
  const id = await withReadableSendError(() => sendPreparedAttachment({
    assertCurrent: session.assertCurrent, uploaded: () => prep.uploaded(files), onUploaded,
    find: () => sendableConvOfLine(line),
    send: (conv, infos) => conv.send({ multiRemoteAttachment: { attachments: infos } }),
  }));
  prep.forget(files);
  return id;
}

export async function resolveRemoteAttachment(info: RemoteAttachmentInfo): Promise<{
  fileUri: string; mimeType?: string; filename?: string;
}> {
  const client = await xmtpClient();
  const dest = freshCacheFile('xmtp-att', 'bin');
  const metadata: RemoteAttachmentMetadata = {
    secret: info.secret, salt: info.salt, nonce: info.nonce,
    contentDigest: info.contentDigest, contentLength: info.contentLength,
    filename: info.filename,
  };
  const encrypted: EncryptedLocalAttachment = {
    encryptedLocalFileUri: asFileUri(dest.uri),
    metadata,
  };
  await File.downloadFileAsync(attachmentDownloadUrl(info.url), dest, { idempotent: true });
  const decrypted = await client.decryptAttachment(encrypted);
  return { fileUri: decrypted.fileUri, mimeType: decrypted.mimeType, filename: decrypted.filename };
}
