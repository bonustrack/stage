
import {
  decryptAttachment, encryptAttachment,
  type EncryptedAttachment, type RemoteAttachment,
} from '@xmtp/browser-sdk';
import { stripMetadataBytes, isStrippableImage } from '@stage-labs/client/image/stripMetadata';
import { sendableConvOfLine } from './xmtp.sdk.web';
import { withReadableSendError } from './xmtp.sdk.core';
import { withMainThreadWasm } from './xmtp.wasm.web';
import type { LocalAttachmentInput, OnAttachmentsUploaded } from './xmtp.types';
import { fromFirstUrl, swarmDownloadUrls, uploadEncryptedAttachment } from './attachmentStorage';
import { attachmentMimeType } from './attachmentFiles';
import { makeAttachmentPrep, sendPreparedAttachment } from './xmtp.attachmentPrep.core';
import { accountClient } from './xmtp.account';

declare const sanitizedBrand: unique symbol;
type SanitizedAttachmentBytes = Uint8Array & { readonly [sanitizedBrand]: true };

async function fetchBytes(uri: string): Promise<Uint8Array> {
  const blob = await (await fetch(uri)).blob();
  return new Uint8Array(await blob.arrayBuffer());
}

function sanitizeAttachmentBytes(
  input: Uint8Array, mimeType: string | undefined, filename: string | undefined,
): SanitizedAttachmentBytes {
  if (!isStrippableImage(mimeType, filename)) return input as SanitizedAttachmentBytes;
  try {
    const { bytes } = stripMetadataBytes(input);
    return bytes as SanitizedAttachmentBytes;
  } catch {
    return input as SanitizedAttachmentBytes;
  }
}

export async function encryptSanitizedAttachment(
  file: { bytes: SanitizedAttachmentBytes; mimeType: string; filename: string },
): Promise<EncryptedAttachment> {
  return await withMainThreadWasm(() => encryptAttachment({
    filename: file.filename, mimeType: file.mimeType, content: file.bytes,
  }));
}

async function uploadEncrypted(payload: Uint8Array, filename: string): Promise<string> {
  return await uploadEncryptedAttachment(new Blob([payload.slice().buffer], { type: 'application/octet-stream' }), filename);
}

async function encryptedFileOf(f: LocalAttachmentInput): Promise<EncryptedAttachment> {
  const mimeType = attachmentMimeType(f.mimeType, f.filename);
  const clean = sanitizeAttachmentBytes(await fetchBytes(f.fileUri), mimeType, f.filename);
  return await encryptSanitizedAttachment({ bytes: clean, mimeType, filename: f.filename });
}

async function storedRemoteAttachment(encrypted: EncryptedAttachment, f: LocalAttachmentInput): Promise<RemoteAttachment> {
  return {
    url: await uploadEncrypted(encrypted.payload, f.filename),
    contentDigest: encrypted.contentDigest,
    secret: encrypted.secret,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    scheme: 'https://',
    contentLength: encrypted.contentLength,
    filename: f.filename,
  };
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
    send: (conv, infos) => conv.sendMultiRemoteAttachment({ attachments: infos }),
  }));
  prep.forget(files);
  return id;
}

export async function resolveRemoteAttachment(info: RemoteAttachment): Promise<{
  fileUri: string; mimeType?: string; filename?: string;
}> {
  const decrypted = await fromFirstUrl(swarmDownloadUrls(info.url), async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Attachment download failed (${res.status})`);
    const encrypted = new Uint8Array(await res.arrayBuffer());
    return await withMainThreadWasm(() => decryptAttachment(encrypted, info));
  });
  const blob = new Blob([decrypted.content.slice().buffer], { type: decrypted.mimeType });
  return {
    fileUri: URL.createObjectURL(blob),
    mimeType: decrypted.mimeType,
    filename: decrypted.filename,
  };
}
