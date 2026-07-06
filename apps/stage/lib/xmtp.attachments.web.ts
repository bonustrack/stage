
import {
  decryptAttachment, encryptAttachment,
  type EncryptedAttachment, type RemoteAttachment,
} from '@xmtp/browser-sdk';
import { stripMetadataBytes, isStrippableImage } from '@stage-labs/client/image/stripMetadata';
import { convOfLine } from './xmtp.client.web';
import { type LocalAttachmentInput } from './xmtp.types';
import { SWARM_UPLOAD_MAX_BYTES, swarmToHttp, tooLargeError, uploadFormToSwarmy } from './swarmy';

export { swarmToHttp } from './swarmy';

declare const sanitizedBrand: unique symbol;
export type SanitizedAttachmentBytes = Uint8Array & { readonly [sanitizedBrand]: true };

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

function mimeOfInput(f: LocalAttachmentInput): string {
  if (f.mimeType.includes('/')) return f.mimeType;
  return EXT_MIME[f.filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

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

export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[],
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);

  const infos: RemoteAttachment[] = [];
  for (const f of files) {
    const mimeType = mimeOfInput(f);
    const clean = sanitizeAttachmentBytes(await fetchBytes(f.fileUri), mimeType, f.filename);
    const encrypted = await encryptSanitizedAttachment({
      bytes: clean, mimeType, filename: f.filename,
    });
    const url = await uploadEncryptedToSwarm(encrypted.payload, f.filename);
    infos.push({
      url,
      contentDigest: encrypted.contentDigest,
      secret: encrypted.secret,
      salt: encrypted.salt,
      nonce: encrypted.nonce,
      scheme: 'https://',
      contentLength: encrypted.contentLength,
      filename: f.filename,
    });
  }
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

export async function fileUriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (typeof result !== 'string') { reject(new Error('FileReader returned non-string')); return; }
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = (): void => { reject(reader.error ?? new Error('FileReader failed')); };
    reader.readAsDataURL(blob);
  });
}
