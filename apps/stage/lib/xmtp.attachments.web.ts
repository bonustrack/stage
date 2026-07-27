
import {
  decryptAttachment, encryptAttachment,
  type EncryptedAttachment, type RemoteAttachment,
} from '@xmtp/browser-sdk';
import { stripMetadataBytes, isStrippableImage } from '@stage-labs/client/image/stripMetadata';
import { convOfLine } from './xmtp.client.web';
import { type LocalAttachmentInput } from './xmtp.types';
import { SWARM_UPLOAD_MAX_BYTES, swarmToHttp, tooLargeError, uploadFormToSwarmy } from './swarmy';
import { attachmentMimeType } from './attachmentFiles';
import { retypeFilename, shrinkImageForUpload } from './attachmentImage.web';

export { swarmToHttp } from './swarmy';
export { fileUriToBase64 } from './attachmentFiles';

declare const sanitizedBrand: unique symbol;
export type SanitizedAttachmentBytes = Uint8Array & { readonly [sanitizedBrand]: true };

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
  return await encryptAttachment({
    filename: file.filename, mimeType: file.mimeType, content: file.bytes,
  });
}

async function uploadEncryptedToSwarm(payload: Uint8Array, filename: string): Promise<string> {
  if (payload.byteLength > SWARM_UPLOAD_MAX_BYTES) throw tooLargeError(filename);
  const form = new FormData();
  form.append('file', new Blob([payload.slice().buffer], { type: 'application/octet-stream' }), 'a.bin');
  return await uploadFormToSwarmy(form, filename);
}

async function remoteAttachmentOf(f: LocalAttachmentInput): Promise<RemoteAttachment> {
  const sourceMime = attachmentMimeType(f.mimeType, f.filename);
  const raw = await fetchBytes(f.fileUri);
  const fitted = await shrinkImageForUpload(raw, sourceMime, SWARM_UPLOAD_MAX_BYTES);
  const filename = fitted.mimeType === sourceMime
    ? f.filename
    : retypeFilename(f.filename, fitted.mimeType);
  const clean = sanitizeAttachmentBytes(fitted.bytes, fitted.mimeType, filename);
  const encrypted = await encryptSanitizedAttachment({
    bytes: clean, mimeType: fitted.mimeType, filename,
  });
  const url = await uploadEncryptedToSwarm(encrypted.payload, filename);
  return {
    url,
    contentDigest: encrypted.contentDigest,
    secret: encrypted.secret,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    scheme: 'https://',
    contentLength: encrypted.contentLength,
    filename,
  };
}

export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[],
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);

  const infos: RemoteAttachment[] = [];
  for (const f of files) infos.push(await remoteAttachmentOf(f));
  return await conv.sendMultiRemoteAttachment({ attachments: infos });
}

export async function resolveRemoteAttachment(info: RemoteAttachment): Promise<{
  fileUri: string; mimeType?: string; filename?: string;
}> {
  const res = await fetch(swarmToHttp(info.url));
  if (!res.ok) throw new Error(`Attachment download failed (${res.status})`);
  const encrypted = new Uint8Array(await res.arrayBuffer());
  const decrypted = await decryptAttachment(encrypted, info);
  const blob = new Blob([decrypted.content.slice().buffer], { type: decrypted.mimeType });
  return {
    fileUri: URL.createObjectURL(blob),
    mimeType: decrypted.mimeType,
    filename: decrypted.filename,
  };
}
