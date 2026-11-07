import {
  decryptAttachment,
  encryptAttachment,
  encodeRemoteAttachment,
  type Conversation,
  type EncryptedAttachment,
  type RemoteAttachment,
} from '@xmtp/browser-sdk';
import { stripMetadataBytes, isStrippableImage } from '@stage-labs/client/image/stripMetadata';
import type { AttachmentKey, RemoteAttachmentRef } from '@stage-labs/client/xmtp/entryPayload';
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

function webKey(key: AttachmentKey): Uint8Array {
  if (key instanceof Uint8Array) return key;
  throw new Error('This attachment key is not in the browser SDK format.');
}

function webRemoteAttachment(info: RemoteAttachmentRef): RemoteAttachment {
  return {
    url: info.url,
    contentDigest: info.contentDigest,
    secret: webKey(info.secret),
    salt: webKey(info.salt),
    nonce: webKey(info.nonce),
    scheme: info.scheme ?? 'https://',
    contentLength: info.contentLength === undefined ? undefined : Number(info.contentLength),
    filename: info.filename,
  };
}

export async function resolveRemoteAttachment(
  info: RemoteAttachmentRef,
): Promise<{ fileUri: string; mimeType?: string; filename?: string }> {
  const remote = webRemoteAttachment(info);
  const res = await fetch(attachmentDownloadUrl(remote.url));
  if (!res.ok) throw new Error(`Attachment download failed (${res.status})`);
  const encrypted = new Uint8Array(await res.arrayBuffer());
  const decrypted = await withMainThreadWasm(() => decryptAttachment(encrypted, remote));
  const blob = new Blob([decrypted.content.slice().buffer], { type: inertBlobType(decrypted.mimeType) });
  return { fileUri: URL.createObjectURL(blob), mimeType: decrypted.mimeType, filename: decrypted.filename };
}
