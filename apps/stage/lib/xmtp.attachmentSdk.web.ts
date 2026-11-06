import {
  decryptAttachment,
  encryptAttachment,
  encodeRemoteAttachment,
  type Conversation,
  type EncryptedAttachment,
  type RemoteAttachment,
} from '@xmtp/browser-sdk';
import { stripMetadataBytes, isStrippableImage } from '@stage-labs/client/image/stripMetadata';
import { withMainThreadWasm } from './xmtp.wasm.web';
import type { LocalAttachmentInput } from './xmtp.types';
import { attachmentDownloadUrl, uploadEncryptedAttachment } from './attachmentStorage';
import { inertBlobType } from './fileOpen.model';
import { attachmentMimeType } from './attachmentFiles';

declare const sanitizedBrand: unique symbol;
type SanitizedAttachmentBytes = Uint8Array & { readonly [sanitizedBrand]: true };

async function fetchBytes(uri: string): Promise<Uint8Array> {
  const blob = await (await fetch(uri)).blob();
  return new Uint8Array(await blob.arrayBuffer());
}

function sanitizeAttachmentBytes(input: Uint8Array, mimeType: string | undefined, filename: string | undefined): SanitizedAttachmentBytes {
  if (!isStrippableImage(mimeType, filename)) return input as SanitizedAttachmentBytes;
  try {
    const { bytes } = stripMetadataBytes(input);
    return bytes as SanitizedAttachmentBytes;
  } catch {
    return input as SanitizedAttachmentBytes;
  }
}

export async function encryptSanitizedAttachment(file: {
  bytes: SanitizedAttachmentBytes;
  mimeType: string;
  filename: string;
}): Promise<EncryptedAttachment> {
  return await withMainThreadWasm(() => encryptAttachment({ filename: file.filename, mimeType: file.mimeType, content: file.bytes }));
}

export async function encryptFile(f: LocalAttachmentInput): Promise<EncryptedAttachment> {
  const mimeType = attachmentMimeType(f.mimeType, f.filename);
  const clean = sanitizeAttachmentBytes(await fetchBytes(f.fileUri), mimeType, f.filename);
  return await encryptSanitizedAttachment({ bytes: clean, mimeType, filename: f.filename });
}

export async function storeEncrypted(encrypted: EncryptedAttachment, f: LocalAttachmentInput): Promise<RemoteAttachment> {
  return {
    url: await uploadEncryptedAttachment(new Blob([encrypted.payload.slice().buffer], { type: 'application/octet-stream' }), f.filename),
    contentDigest: encrypted.contentDigest,
    secret: encrypted.secret,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    scheme: 'https://',
    contentLength: encrypted.contentLength,
    filename: f.filename,
  };
}

export function sendFiles(conv: Conversation, infos: RemoteAttachment[]): Promise<string> {
  return conv.sendMultiRemoteAttachment({ attachments: infos });
}

export async function sendFileReply(conv: Conversation, replyTo: string, info: RemoteAttachment): Promise<string> {
  return conv.sendReply({ reference: replyTo, content: await withMainThreadWasm(() => encodeRemoteAttachment(info)) });
}

export async function resolveRemoteAttachment(info: RemoteAttachment): Promise<{ fileUri: string; mimeType?: string; filename?: string }> {
  const res = await fetch(attachmentDownloadUrl(info.url));
  if (!res.ok) throw new Error(`Attachment download failed (${res.status})`);
  const encrypted = new Uint8Array(await res.arrayBuffer());
  const decrypted = await withMainThreadWasm(() => decryptAttachment(encrypted, info));
  const blob = new Blob([decrypted.content.slice().buffer], { type: inertBlobType(decrypted.mimeType) });
  return { fileUri: URL.createObjectURL(blob), mimeType: decrypted.mimeType, filename: decrypted.filename };
}
