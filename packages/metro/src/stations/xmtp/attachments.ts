/** Persist inbound XMTP attachments to disk so the agent can read them.
 *
 *  Inline `attachment` content arrives already-decrypted ({filename, mimeType,
 *  data}). `remoteStaticAttachment` / `multiRemote*` content references encrypted
 *  bytes hosted off-network — we fetch the url + decrypt with the per-attachment
 *  secret/salt/nonce and verify the contentDigest via the XMTP SDK's
 *  `RemoteAttachmentCodec.load`. Either way we write the plaintext bytes to a
 *  stable file under ATT_DIR and hand back the absolute path so the emitted
 *  envelope can carry it (payload.attachments[].path) and reference it in text. */

import { AttachmentCodec, RemoteAttachmentCodec, ContentTypeAttachment } from '@xmtp/content-type-remote-attachment';

const ATT_DIR = process.env.METRO_XMTP_ATTACH_DIR
  ?? `${process.env.HOME}/.cache/metro/messenger-uploads`;

// Minimal codec registry for RemoteAttachmentCodec.load — the encrypted payload
// decodes to an inner `attachment` EncodedContent, so only that codec is needed.
const attachmentCodec = new AttachmentCodec();
const loadRegistry = {
  codecFor(ct: { typeId?: string }) {
    return ct?.typeId === ContentTypeAttachment.typeId ? attachmentCodec : undefined;
  },
};

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/heic': 'heic', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'video/webm': 'webm', 'application/pdf': 'pdf',
};

function extFor(filename: string | undefined, mime: string | undefined): string {
  const fromName = filename?.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length >= 1 && fromName.length <= 5) return fromName;
  if (mime && MIME_EXT[mime]) return MIME_EXT[mime];
  if (mime?.startsWith('image/')) return mime.slice(6).replace('jpeg', 'jpg');
  return 'bin';
}

/** Stable, unique on-disk name: msg_<messageId 12>_<index>.<ext>. Deterministic
 *  per (message, attachment) so a re-stream of the same message overwrites
 *  rather than duplicating. */
function fileName(messageId: string, index: number, filename: string | undefined, mime: string | undefined): string {
  const safeId = messageId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'unknown';
  return `msg_${safeId}_${index}.${extFor(filename, mime)}`;
}

/** A remote-attachment entry as the train already shaped it (decoded fields). */
export type RemoteEntry = {
  url: string; filename?: string; contentDigest?: string;
  nonce?: Uint8Array; salt?: Uint8Array; secret?: Uint8Array;
  scheme?: string; contentLength?: number;
};

export type SavedAttachment = { path: string; mime?: string; name?: string; bytes: number };

async function writeBytes(
  data: Uint8Array, messageId: string, index: number,
  filename: string | undefined, mime: string | undefined,
): Promise<SavedAttachment> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  await mkdir(ATT_DIR, { recursive: true });
  const path = join(ATT_DIR, fileName(messageId, index, filename, mime));
  await writeFile(path, data);
  return { path, mime, name: filename, bytes: data.length };
}

/** Write an already-decrypted inline attachment to disk. */
export async function saveInlineAttachment(
  a: { filename?: string; mimeType?: string; content: Uint8Array },
  messageId: string, index = 0,
): Promise<SavedAttachment> {
  return writeBytes(a.content, messageId, index, a.filename, a.mimeType);
}

/** Fetch + decrypt a remote attachment via the XMTP SDK, then write to disk. */
export async function saveRemoteAttachment(
  r: RemoteEntry, messageId: string, index = 0,
): Promise<SavedAttachment> {
  const remote = {
    url: r.url,
    contentDigest: r.contentDigest ?? '',
    salt: r.salt ?? new Uint8Array(),
    nonce: r.nonce ?? new Uint8Array(),
    secret: r.secret ?? new Uint8Array(),
    scheme: r.scheme ?? 'https://',
    contentLength: r.contentLength ?? 0,
    filename: r.filename ?? '',
  };
  const decoded = await RemoteAttachmentCodec.load<{ filename?: string; mimeType?: string; data: Uint8Array }>(
    remote, loadRegistry,
  );
  return writeBytes(decoded.data, messageId, index, decoded.filename ?? r.filename, decoded.mimeType);
}
