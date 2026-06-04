/** Persist inbound Discord attachments to disk so the agent can read them.
 *  Discord attachments are PUBLIC CDN URLs (no decryption): fetch `.url`, write
 *  to ATT_DIR, return the absolute path. Mirrors the XMTP convention. */

const ATT_DIR = process.env.METRO_XMTP_ATTACH_DIR
  ?? `${process.env.HOME}/.cache/metro/messenger-uploads`;

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

/** Stable on-disk name: msg_<messageId 16>_<index>.<ext>. */
function fileName(messageId: string, index: number, filename: string | undefined, mime: string | undefined): string {
  const safeId = messageId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || 'unknown';
  return `msg_${safeId}_${index}.${extFor(filename, mime)}`;
}

export type SavedAttachment = { path: string; mime?: string; name?: string; bytes: number };

/** A Discord attachment as the train shaped it (url + metadata). */
export type DiscordAttachmentRef = {
  url: string; name?: string | null; contentType?: string | null;
};

/** Fetch a public Discord CDN URL and write the bytes to disk. */
export async function saveDiscordAttachment(
  a: DiscordAttachmentRef, messageId: string, index = 0,
): Promise<SavedAttachment> {
  const res = await fetch(a.url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`discord attachment fetch ${res.status} for ${a.url}`);
  const data = new Uint8Array(await res.arrayBuffer());
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  await mkdir(ATT_DIR, { recursive: true });
  const mime = a.contentType ?? undefined;
  const name = a.name ?? undefined;
  const path = join(ATT_DIR, fileName(messageId, index, name, mime));
  await writeFile(path, data);
  return { path, mime, name, bytes: data.length };
}
